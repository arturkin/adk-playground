import { createRunner } from "../agents/index.js";
import { getBrowserManager } from "../browser/index.js";
import { type AppConfig } from "../config/schema.js";
import { TestCase, TestSuite } from "../types/test.js";
import { TestRunResult, TestCaseResult, BugReport } from "../types/report.js";
import {
  runStore,
  lessonStore,
  analyzeFailure,
  testCorrectionManager,
} from "../memory/index.js";
import {
  formatLessonsForNavigator,
  formatLessonsForValidator,
} from "../memory/lesson-formatter.js";
import { loadKnowledgeBase } from "./discovery.js";
import { getFunctionCalls, stringifyContent } from "@google/adk";
import { execSync } from "child_process";

export interface RunOptions {
  autoFix?: boolean;
}

/**
 * Executes a single test case using the multi-agent orchestrator.
 */
export async function runTestCase(
  testCase: TestCase,
  config: AppConfig,
  runner: ReturnType<typeof createRunner>,
  runId: string,
  options: RunOptions = {},
): Promise<TestCaseResult> {
  const startTime = Date.now();
  console.log(`\x1b[1mRunning Test: ${testCase.title}\x1b[0m`);

  // Try to find viewport preset
  const viewport =
    config.viewports.find((v) => v.name === testCase.viewport) ||
    config.viewports[0];
  const browser = getBrowserManager(viewport);

  const knowledgeBase = await loadKnowledgeBase(config.knowledgeBaseDir);

  // Load active failure lessons for this test
  const activeLessons = lessonStore.getActiveLessons(testCase.id);
  const failureLessons = formatLessonsForNavigator(activeLessons);
  const validatorFailureContext = formatLessonsForValidator(activeLessons);

  try {
    // We launch browser for each test to ensure clean state
    await browser.launch(config.headless);

    const formattedSteps = testCase.steps
      .map((s) => `${s.index}. ${s.instruction}`)
      .join("\n");

    const session = await runner.sessionService.createSession({
      appName: "adk-qa",
      userId: "test-runner",
      state: {
        task_steps: formattedSteps,
        url_hint: testCase.url,
        expected_criteria: testCase.expectedOutcome,
        current_viewport: testCase.viewport,
        knowledge_base: knowledgeBase,
        failure_lessons: failureLessons,
        validator_failure_context: validatorFailureContext,
        assertion_count: String(testCase.assertions.length),
        test_assertions:
          `You MUST call record_assertion exactly ${testCase.assertions.length} time(s) — one for each assertion:\n` +
          testCase.assertions
            .map((a, i) => `- Assertion ID ${i + 1}: "${a.description}"`)
            .join("\n"),
        // Parallel JSON format for the record_assertion tool to look up originals
        _test_assertions_json: JSON.stringify(
          testCase.assertions.map((a, i) => ({
            id: i + 1,
            description: a.description,
          })),
        ),
      },
    });

    for await (const event of runner.runAsync({
      userId: "test-runner",
      sessionId: session.id,
      newMessage: {
        role: "user",
        parts: [
          {
            text:
              `Execute Automated Test: ${testCase.title}\n` +
              `Target URL: ${testCase.url}\n` +
              `Steps:\n${formattedSteps}`,
          },
        ],
      },
    })) {
      if (event.author && event.author !== "user") {
        const text = stringifyContent(event);
        if (text) {
          console.log(
            `  \x1b[36m[Agent: ${event.author}]\x1b[0m ${text.substring(0, 500)}${text.length > 500 ? "..." : ""}`,
          );
        }

        const functionCalls = getFunctionCalls(event);
        for (const call of functionCalls) {
          console.log(`    \x1b[33m[Tool: ${call.name}] calling...\x1b[0m`);
        }
      }
    }

    const sessionDetails = await runner.sessionService.getSession({
      appName: "adk-qa",
      userId: "test-runner",
      sessionId: session.id,
    });

    const validationResult =
      (sessionDetails?.state?.["validation_result"] as string) || "";
    const finalReport =
      (sessionDetails?.state?.["final_report"] as string) || "";
    const bugsJson = (sessionDetails?.state?.["bugs"] as string) || "[]";
    const latestScreenshot =
      (sessionDetails?.state?.["latest_screenshot"] as string) || "";
    const assertionsJson =
      (sessionDetails?.state?.["assertions"] as string) || "[]";
    const assertions = JSON.parse(assertionsJson);

    const bugs: BugReport[] = JSON.parse(bugsJson);

    // Save the latest screenshot if it exists
    const screenshotFiles: string[] = [];
    if (latestScreenshot) {
      const filename = `screenshot_${Date.now()}.png`;
      runStore.saveScreenshot(runId, filename, latestScreenshot);
      screenshotFiles.push(filename);
    }

    let status: "passed" | "failed" | "inconclusive" | "error";
    let statusReason: string;

    // Signal 1: validation_result text
    const validationVerdict = validationResult.toUpperCase();
    const validatorSaysPass =
      validationVerdict.includes("PASS") && !validationVerdict.includes("FAIL");
    const validatorSaysFail = validationVerdict.includes("FAIL");

    // Signal 2: recorded assertions
    const hasAssertions = assertions.length > 0;
    const allAssertionsPassed =
      hasAssertions &&
      assertions.every((a: any) => {
        const original = testCase.assertions[a.id - 1];
        if (!original) return false;
        return (
          a.passed === true &&
          a.description.trim().toLowerCase() ===
            original.description.trim().toLowerCase()
        );
      });
    const anyAssertionFailed =
      hasAssertions &&
      (assertions.some((a: any) => a.passed === false) ||
        assertions.length < testCase.assertions.length);

    // Signal 3: bugs found (structural safeguard)
    const hasSeriousBugs = bugs.some((b: BugReport) =>
      ["critical", "high", "medium"].includes(b.severity),
    );

    // Signal 4: test expects assertions but none were recorded
    const expectedAssertionCount = testCase.assertions.length;
    const noAssertionsRecorded =
      expectedAssertionCount > 0 && assertions.length === 0;

    // Decision logic
    if (validatorSaysFail || anyAssertionFailed) {
      status = "failed";
      if (validatorSaysFail && anyAssertionFailed) {
        const failedCount = assertions.filter((a: any) => !a.passed).length;
        statusReason = `Validator said FAIL + ${failedCount} assertion(s) failed`;
      } else if (validatorSaysFail) {
        statusReason = "Validator explicitly said FAIL";
      } else {
        const failedCount = assertions.filter((a: any) => !a.passed).length;
        const missing = testCase.assertions.length - assertions.length;
        statusReason = missing > 0
          ? `${failedCount} assertion(s) failed, ${missing} not recorded`
          : `${failedCount} assertion(s) failed`;
      }
    } else if (hasSeriousBugs) {
      status = "failed";
      const serious = bugs.filter((b: BugReport) => ["critical", "high", "medium"].includes(b.severity));
      statusReason = `${serious.length} serious bug(s): ${serious.map(b => b.severity).join(", ")}`;
    } else if (noAssertionsRecorded) {
      // Validator produced no output at all — we don't know the outcome
      status = "inconclusive";
      statusReason = `Validator recorded 0/${expectedAssertionCount} expected assertions — validator may have failed silently (empty model response?)`;
    } else if (validatorSaysPass && (!hasAssertions || allAssertionsPassed)) {
      status = "passed";
      statusReason = hasAssertions
        ? `All ${assertions.length}/${expectedAssertionCount} assertions passed + validator confirmed PASS`
        : "Validator confirmed PASS";
    } else if (hasAssertions && allAssertionsPassed) {
      status = "passed";
      statusReason = `All ${assertions.length}/${expectedAssertionCount} assertions passed`;
    } else if (!validationResult && !hasAssertions) {
      status = "inconclusive";
      statusReason = "No validation output and no assertions recorded";
    } else {
      status = "inconclusive";
      statusReason = `Mixed signals — validator: "${validationResult.substring(0, 60) || "(empty)"}", assertions: ${assertions.length}/${expectedAssertionCount}`;
    }

    const statusColor = status === "passed" ? "\x1b[32m" : status === "failed" ? "\x1b[31m" : "\x1b[33m";
    console.log(`  ${statusColor}[${status.toUpperCase()}]\x1b[0m ${statusReason}`);
    if (noAssertionsRecorded) {
      console.warn(`  \x1b[33m[Warning] No assertions recorded — check validator model output above\x1b[0m`);
    }

    const testResult: TestCaseResult = {
      testId: testCase.id,
      title: testCase.title,
      status,
      statusReason,
      duration: Date.now() - startTime,
      bugs,
      assertions,
      screenshots: screenshotFiles,
      agentOutput: finalReport,
      validationOutput: validationResult,
    };

    // Record lessons based on test outcome
    if (status === "failed") {
      const prevConsecutiveCount = lessonStore.getConsecutiveFailureCount(
        testCase.id,
      );
      const lesson = analyzeFailure(testResult, runId, prevConsecutiveCount);
      lessonStore.addLesson(lesson);
      console.log(
        `  \x1b[33m[Self-Correction] Failure lesson recorded (${lesson.failureCategory}, consecutive: ${lesson.consecutiveFailures})\x1b[0m`,
      );

      // Check for test definition corrections after threshold
      const allLessons = lessonStore.getActiveLessons(testCase.id);
      const corrections = testCorrectionManager.analyzeForCorrections(
        testCase,
        allLessons,
      );

      if (corrections.length > 0) {
        console.log(
          `  \x1b[33m[Test Corrections] ${corrections.length} suggestion(s) generated:\x1b[0m`,
        );
        corrections.forEach((c) => {
          console.log(`    - ${c.correctionType}: ${c.description}`);
        });

        if (options.autoFix) {
          console.log(`  \x1b[33m[Auto-Fix] Applying corrections...\x1b[0m`);
          corrections.forEach((c) => {
            try {
              testCorrectionManager.applyCorrection(c);
            } catch (e) {
              console.error(
                `    Failed to apply correction: ${(e as Error).message}`,
              );
            }
          });
        } else {
          console.log(
            `  \x1b[36m[Hint] Use --auto-fix to automatically apply corrections\x1b[0m`,
          );
        }
      }
    } else if (status === "passed") {
      lessonStore.markResolved(testCase.id);
      console.log(
        `  \x1b[32m[Self-Correction] Previous failures resolved\x1b[0m`,
      );
    }

    return testResult;
  } catch (error) {
    console.error(`Test failed with error: ${(error as Error).message}`);

    const errorResult: TestCaseResult = {
      testId: testCase.id,
      title: testCase.title,
      status: "error",
      statusReason: `Unhandled exception: ${(error as Error).message}`,
      duration: Date.now() - startTime,
      bugs: [],
      assertions: [],
      screenshots: [],
      agentOutput: "",
      error: (error as Error).message,
    };

    // Record lesson for error status
    const prevConsecutiveCount = lessonStore.getConsecutiveFailureCount(
      testCase.id,
    );
    const lesson = analyzeFailure(errorResult, runId, prevConsecutiveCount);
    lessonStore.addLesson(lesson);
    console.log(
      `  \x1b[33m[Self-Correction] Failure lesson recorded (${lesson.failureCategory}, consecutive: ${lesson.consecutiveFailures})\x1b[0m`,
    );

    // Check for corrections on error status too
    const allLessons = lessonStore.getActiveLessons(testCase.id);
    const corrections = testCorrectionManager.analyzeForCorrections(
      testCase,
      allLessons,
    );

    if (corrections.length > 0) {
      console.log(
        `  \x1b[33m[Test Corrections] ${corrections.length} suggestion(s) generated:\x1b[0m`,
      );
      corrections.forEach((c) => {
        console.log(`    - ${c.correctionType}: ${c.description}`);
      });

      if (options.autoFix) {
        console.log(`  \x1b[33m[Auto-Fix] Applying corrections...\x1b[0m`);
        corrections.forEach((c) => {
          try {
            testCorrectionManager.applyCorrection(c);
          } catch (e) {
            console.error(
              `    Failed to apply correction: ${(e as Error).message}`,
            );
          }
        });
      }
    }

    return errorResult;
  } finally {
    // Wait for a few seconds if not headless to see the last state
    if (!config.headless) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    await browser.close();
  }
}

/**
 * Executes a whole test suite.
 */
export async function runTestSuite(
  suite: TestSuite,
  config: AppConfig,
  options: RunOptions = {},
): Promise<TestRunResult> {
  const startTime = Date.now();
  const runId = `run-${Date.now()}`;
  const results: TestCaseResult[] = [];
  const runner = createRunner(config);

  for (const testCase of suite.testCases) {
    const result = await runTestCase(testCase, config, runner, runId, options);
    results.push(result);
  }

  const duration = Date.now() - startTime;
  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const inconclusive = results.filter(
    (r) => r.status === "inconclusive",
  ).length;
  const errors = results.filter((r) => r.status === "error").length;

  let gitCommit: string | undefined;
  try {
    gitCommit = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch (e) {
    // Ignore if not a git repo
  }

  return {
    runId,
    timestamp: new Date().toISOString(),
    gitCommit,
    modelConfig: {
      navigator: config.models.navigator,
      validator: config.models.validator,
      reporter: config.models.reporter,
      evaluator: config.models.evaluator,
    },
    results,
    summary: {
      total: suite.testCases.length,
      passed,
      failed,
      inconclusive,
      errors,
      duration,
    },
  };
}
