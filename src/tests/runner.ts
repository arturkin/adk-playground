import { createRunner } from "../agents/index.js";
import { getBrowserManager } from "../browser/index.js";
import { type AppConfig } from "../config/schema.js";
import { KNOWLEDGE_BASE_DIR } from "../constants.js";
import { TestCase, TestSuite } from "../types/test.js";
import {
  TestRunResult,
  TestCaseResult,
  BugReport,
  EvaluationResult,
  StepAssertionResult,
  AssertionResult,
} from "../types/report.js";
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
import { execSync, spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import type { LogEntry } from "../logger/index.js";
import type { WorkerResult } from "./worker.js";
import { log } from "../logger/index.js";

export interface RunOptions {
  autoFix?: boolean;
  /** When true, lesson recording is skipped (used by parallel workers — the parent records lessons). */
  skipLessons?: boolean;
}

/**
 * Records failure lessons and applies corrections for a completed test case.
 * Called by the parent process after collecting worker results in parallel mode,
 * or inline by runTestCase in sequential mode.
 */
export function recordTestLessons(
  testCase: TestCase,
  result: TestCaseResult,
  runId: string,
  options: RunOptions = {},
): void {
  if (result.status === "failed" || result.status === "error") {
    const prevConsecutiveCount = lessonStore.getConsecutiveFailureCount(
      testCase.id,
    );
    const lesson = analyzeFailure(result, runId, prevConsecutiveCount);
    lessonStore.addLesson(lesson);
    log.info(
      `[Self-Correction] Failure lesson recorded (${lesson.failureCategory}, consecutive: ${lesson.consecutiveFailures})`,
    );

    const allLessons = lessonStore.getActiveLessons(testCase.id);
    const corrections = testCorrectionManager.analyzeForCorrections(
      testCase,
      allLessons,
    );

    if (corrections.length > 0) {
      log.info(
        `[Test Corrections] ${corrections.length} suggestion(s) generated:`,
      );
      corrections.forEach((c) => {
        log.info(`  - ${c.correctionType}: ${c.description}`);
      });

      if (options.autoFix) {
        log.info("[Auto-Fix] Applying corrections...");
        corrections.forEach((c) => {
          try {
            testCorrectionManager.applyCorrection(c);
          } catch (e) {
            log.error(`Failed to apply correction: ${(e as Error).message}`);
          }
        });
      } else {
        log.info("[Hint] Use --auto-fix to automatically apply corrections");
      }
    }
  } else if (result.status === "passed") {
    lessonStore.markResolved(testCase.id);
    log.info("[Self-Correction] Previous failures resolved");
  }
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
  log.info(`Running Test: ${testCase.title}`);

  // Try to find viewport preset
  const viewport =
    config.viewports.find((v) => v.name === testCase.viewport) ||
    config.viewports[0];
  const browser = getBrowserManager(viewport);

  const knowledgeBase = await loadKnowledgeBase(KNOWLEDGE_BASE_DIR);

  // Load active failure lessons for this test
  const activeLessons = lessonStore.getActiveLessons(testCase.id);
  const failureLessons = formatLessonsForNavigator(activeLessons);
  const validatorFailureContext = formatLessonsForValidator(activeLessons);

  try {
    // We launch browser for each test to ensure clean state
    if (config.cdpEndpoint) {
      await browser.connectCDP(config.cdpEndpoint);
    } else {
      await browser.launch(config.headless);
    }

    // Build step assertions JSON for the tool to reference
    const stepAssertionsForState: {
      stepIndex: number;
      id: number;
      description: string;
    }[] = [];
    let stepAssertionIdCounter = 1;

    const formattedSteps = testCase.steps
      .map((s) => {
        let line = `${s.index}. ${s.instruction}`;
        const assertions =
          s.assertions && s.assertions.length > 0
            ? s.assertions
            : [
                {
                  description: `Step ${s.index} completed successfully: ${s.instruction}`,
                },
              ];
        line += `\n   Assertions for step ${s.index}:`;
        for (const a of assertions) {
          const id = stepAssertionIdCounter++;
          stepAssertionsForState.push({
            stepIndex: s.index,
            id,
            description: a.description,
          });
          line += `\n   - ID ${id}: "${a.description}"`;
        }
        return line;
      })
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
        // Per-step assertions for the navigator
        step_assertions_json: JSON.stringify(stepAssertionsForState),
        step_assertions: "[]",
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
          log.info(
            `${text.substring(0, 500)}${text.length > 500 ? "..." : ""}`,
            { agent: event.author },
          );
        }

        const functionCalls = getFunctionCalls(event);
        for (const call of functionCalls) {
          log.debug(`Tool: ${call.name} calling...`);
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
    const stepAssertionsJson =
      (sessionDetails?.state?.["step_assertions"] as string) || "[]";
    const stepAssertions: StepAssertionResult[] =
      JSON.parse(stepAssertionsJson);
    const evaluationJson =
      (sessionDetails?.state?.["evaluation_result"] as string) || "";
    const evaluation = evaluationJson ? JSON.parse(evaluationJson) : null;

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
    const expectedAssertionCount = testCase.assertions.length;
    const allAssertionsPassed =
      hasAssertions &&
      assertions.every((a: AssertionResult) => {
        const original = testCase.assertions[a.id - 1];
        if (!original) return false;
        return (
          a.passed === true &&
          a.description.trim().toLowerCase() ===
            original.description.trim().toLowerCase()
        );
      });
    const someExplicitlyFailed =
      hasAssertions &&
      assertions.some((a: AssertionResult) => a.passed === false);
    const assertionsMissing = assertions.length < expectedAssertionCount;
    // Only treat missing as failed when at least one was also explicitly failed,
    // or when none were recorded at all. Missing-but-all-passing = inconclusive.
    const anyAssertionFailed = someExplicitlyFailed;

    // Signal 3: step assertions
    const hasStepAssertionFailures = stepAssertions.some((sa) => !sa.passed);

    // Signal 4: bugs found (structural safeguard)
    const hasSeriousBugs = bugs.some((b: BugReport) =>
      ["critical", "high", "medium"].includes(b.severity),
    );

    // Signal 5: test expects assertions but none were recorded
    const noAssertionsRecorded =
      expectedAssertionCount > 0 && assertions.length === 0;

    // Decision logic
    if (validatorSaysFail || anyAssertionFailed || hasStepAssertionFailures) {
      status = "failed";
      const reasons: string[] = [];
      if (validatorSaysFail) reasons.push("Validator said FAIL");
      if (anyAssertionFailed) {
        const failedCount = assertions.filter(
          (a: AssertionResult) => !a.passed,
        ).length;
        reasons.push(`${failedCount} assertion(s) explicitly failed`);
      }
      if (hasStepAssertionFailures) {
        const failedStepCount = stepAssertions.filter(
          (sa) => !sa.passed,
        ).length;
        reasons.push(`${failedStepCount} step assertion(s) failed`);
      }
      statusReason = reasons.join(" + ");
    } else if (hasSeriousBugs) {
      status = "failed";
      const serious = bugs.filter((b: BugReport) =>
        ["critical", "high", "medium"].includes(b.severity),
      );
      statusReason = `${serious.length} serious bug(s): ${serious.map((b) => b.severity).join(", ")}`;
    } else if (noAssertionsRecorded) {
      // Validator produced no output at all — we don't know the outcome
      status = "inconclusive";
      statusReason = `Validator recorded 0/${expectedAssertionCount} expected assertions — validator may have failed silently (empty model response?)`;
    } else if (validatorSaysPass && allAssertionsPassed && !assertionsMissing) {
      status = "passed";
      statusReason = `All ${assertions.length}/${expectedAssertionCount} assertions passed + validator confirmed PASS`;
    } else if (validatorSaysPass && !hasAssertions) {
      status = "passed";
      statusReason = "Validator confirmed PASS";
    } else if (allAssertionsPassed && !assertionsMissing) {
      status = "passed";
      statusReason = `All ${assertions.length}/${expectedAssertionCount} assertions passed`;
    } else if (hasAssertions && allAssertionsPassed && assertionsMissing) {
      // Recorded assertions all passed but validator didn't cover every assertion.
      // We can't confirm pass without full coverage — inconclusive, not failed.
      status = "inconclusive";
      const missing = expectedAssertionCount - assertions.length;
      statusReason = `${assertions.length}/${expectedAssertionCount} assertions passed, ${missing} not recorded by validator`;
    } else if (!validationResult && !hasAssertions) {
      status = "inconclusive";
      statusReason = "No validation output and no assertions recorded";
    } else {
      status = "inconclusive";
      statusReason = `Mixed signals — validator: "${validationResult.substring(0, 60) || "(empty)"}", assertions: ${assertions.length}/${expectedAssertionCount}`;
    }

    // Signal 6: evaluator override (applies after initial status is set)
    if (evaluation) {
      if (evaluation.override === "FAIL" && status !== "failed") {
        status = "failed";
        statusReason = `Evaluator override (confidence: ${evaluation.confidence}/100): ${evaluation.reason}`;
      } else if (evaluation.confidence < 50 && status === "passed") {
        status = "inconclusive";
        statusReason = `Low evaluator confidence (${evaluation.confidence}/100): ${evaluation.reason}`;
      }
      log.info(
        `[Evaluator] confidence=${evaluation.confidence}/100${evaluation.override ? ` → OVERRIDE ${evaluation.override}` : ""}`,
        { reason: evaluation.reason },
      );
    }

    if (status === "failed") {
      log.error(`[FAILED] ${statusReason}`, { testId: testCase.id });
    } else if (status === "inconclusive") {
      log.warn(`[INCONCLUSIVE] ${statusReason}`, { testId: testCase.id });
    } else {
      log.info(`[${status.toUpperCase()}] ${statusReason}`);
    }
    if (noAssertionsRecorded) {
      log.warn("No assertions recorded — check validator model output above", {
        testId: testCase.id,
      });
    }

    const testResult: TestCaseResult = {
      testId: testCase.id,
      title: testCase.title,
      status,
      statusReason,
      duration: Date.now() - startTime,
      bugs,
      assertions,
      stepAssertions: stepAssertions.length > 0 ? stepAssertions : undefined,
      screenshots: screenshotFiles,
      agentOutput: finalReport,
      validationOutput: validationResult,
      evaluationResult: evaluation as EvaluationResult | undefined,
    };

    // Record lessons based on test outcome (skipped when parent handles it in parallel mode)
    if (!options.skipLessons) {
      recordTestLessons(testCase, testResult, runId, options);
    }

    return testResult;
  } catch (error) {
    log.error(`Test failed with error: ${(error as Error).message}`);

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

    // Record lesson for error status (skipped when parent handles it in parallel mode)
    if (!options.skipLessons) {
      recordTestLessons(testCase, errorResult, runId, options);
    }

    return errorResult;
  } finally {
    // Wait for a few seconds if not headless to see the last state
    if (!config.headless) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
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
    let result: TestCaseResult | undefined;
    await log.group(`Test: ${testCase.title}`, async () => {
      result = await runTestCase(testCase, config, runner, runId, options);
      if (result.status === "inconclusive") {
        log.warn("[Retry] Inconclusive result — retrying once");
        result = await runTestCase(testCase, config, runner, runId, options);
      }
    });
    results.push(result!);
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
  } catch {
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

/**
 * Replays a set of captured LogEntry objects through the parent's logger.
 * Preserves group nesting based on the _groupDepth context attached by BufferTransport.
 */
function replayLogs(entries: LogEntry[], testTitle: string): void {
  log.group(`Test: ${testTitle}`, async () => {
    for (const entry of entries) {
      if (entry.context?.["_groupStart"]) {
        // groupStart entries are replayed inline — the group structure is
        // already visible through indentation in the buffered output
        log.info(entry.message);
        continue;
      }
      const ctx = entry.context
        ? Object.fromEntries(
            Object.entries(entry.context).filter(
              ([k]) => k !== "_groupDepth" && k !== "_groupStart",
            ),
          )
        : undefined;
      const safeCtx =
        ctx && Object.keys(ctx).length > 0
          ? (ctx as Record<string, string | number | boolean | undefined>)
          : undefined;
      if (entry.level === "error") log.error(entry.message, safeCtx);
      else if (entry.level === "warn") log.warn(entry.message, safeCtx);
      else if (entry.level === "debug") log.debug(entry.message, safeCtx);
      else log.info(entry.message, safeCtx);
    }
  });
}

/**
 * Runs a single test case in a subprocess worker and returns its result.
 * The worker buffers its logs in memory and sends them in the JSON output;
 * the parent replays them as a contiguous block through its own logger.
 */
function runWorker(
  testCase: TestCase,
  runId: string,
  workerScript: string,
  env: NodeJS.ProcessEnv,
): Promise<TestCaseResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [workerScript, "--test-file", testCase.filePath, "--run-id", runId],
      { env },
    );

    let stdoutData = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutData += chunk.toString();
    });

    // Infra-level errors from the worker process itself (not test logs)
    child.stderr.on("data", (chunk: Buffer) => {
      process.stderr.write(chunk);
    });

    child.on("close", (code) => {
      if (code !== 0 && !stdoutData.trim()) {
        reject(
          new Error(
            `Worker exited with code ${code} for test "${testCase.title}"`,
          ),
        );
        return;
      }

      const lastLine = stdoutData.trim().split("\n").pop() ?? "";
      try {
        const workerResult = JSON.parse(lastLine) as WorkerResult;
        replayLogs(workerResult.logs, testCase.title);
        resolve(workerResult.result);
      } catch {
        reject(
          new Error(
            `Worker for "${testCase.title}" produced invalid JSON: ${lastLine.substring(0, 200)}`,
          ),
        );
      }
    });

    child.on("error", (err) => {
      reject(
        new Error(
          `Failed to spawn worker for "${testCase.title}": ${err.message}`,
        ),
      );
    });
  });
}

/**
 * Executes a test suite with N tests running concurrently via subprocess workers.
 * Worker logs are buffered and printed as contiguous blocks to prevent interleaving.
 */
export async function runTestSuiteParallel(
  suite: TestSuite,
  config: AppConfig,
  options: RunOptions & { concurrency: number },
): Promise<TestRunResult> {
  const startTime = Date.now();
  const runId = `run-${Date.now()}`;
  const { concurrency } = options;

  const workerScript = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "worker.ts",
  );

  const workerEnv: NodeJS.ProcessEnv = { ...process.env };

  log.info(
    `Running ${suite.testCases.length} tests with concurrency=${concurrency}`,
  );

  // Process tests in batches of `concurrency`
  const allResults: TestCaseResult[] = [];
  const testCases = [...suite.testCases];

  while (testCases.length > 0) {
    const batch = testCases.splice(0, concurrency);

    const batchResults = await Promise.all(
      batch.map(async (testCase) => {
        try {
          return await runWorker(testCase, runId, workerScript, workerEnv);
        } catch (err) {
          log.error(
            `Worker failed for "${testCase.title}": ${(err as Error).message}`,
          );
          const errorResult: TestCaseResult = {
            testId: testCase.id,
            title: testCase.title,
            status: "error",
            statusReason: `Worker process error: ${(err as Error).message}`,
            duration: 0,
            bugs: [],
            assertions: [],
            screenshots: [],
            agentOutput: "",
            error: (err as Error).message,
          };
          return errorResult;
        }
      }),
    );

    // Retry inconclusive tests (one retry per test, sequentially to avoid pile-on)
    const finalBatchResults: TestCaseResult[] = [];
    for (let i = 0; i < batchResults.length; i++) {
      let result = batchResults[i];
      if (result.status === "inconclusive") {
        log.warn(
          `[Retry] Inconclusive result for "${batch[i].title}" — retrying once`,
        );
        try {
          result = await runWorker(
            batch[i],
            runId,
            workerScript,
            workerEnv,
          );
        } catch (err) {
          log.error(
            `Retry worker failed for "${batch[i].title}": ${(err as Error).message}`,
          );
        }
      }
      finalBatchResults.push(result);
    }

    allResults.push(...finalBatchResults);
  }

  // Record lessons sequentially (avoids concurrent writes to lessons.json)
  for (const result of allResults) {
    const testCase = suite.testCases.find((tc) => tc.id === result.testId);
    if (testCase) {
      recordTestLessons(testCase, result, runId, options);
    }
  }

  const duration = Date.now() - startTime;
  const passed = allResults.filter((r) => r.status === "passed").length;
  const failed = allResults.filter((r) => r.status === "failed").length;
  const inconclusive = allResults.filter(
    (r) => r.status === "inconclusive",
  ).length;
  const errors = allResults.filter((r) => r.status === "error").length;

  let gitCommit: string | undefined;
  try {
    gitCommit = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch {
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
    results: allResults,
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
