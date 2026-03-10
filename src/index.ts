import { Command } from "commander";
import { config } from "./config/index.js";
import { createRunner } from "./agents/index.js";
import { getBrowserManager } from "./browser/index.js";
import { discoverTests } from "./tests/discovery.js";
import { runTestSuite } from "./tests/runner.js";
import { parseTestCase } from "./tests/parser.js";
import { getFunctionCalls, stringifyContent } from "@google/adk";
import { runStore, detectRegressions, lessonStore } from "./memory/index.js";
import { formatMarkdownReport, reportWriter } from "./reports/index.js";
import type { TestRunResult, RegressionReport } from "./types/report.js";

// --- Helpers ---

function requireApiKey(): void {
  if (!config.apiKey) {
    console.error("Error: GOOGLE_GENAI_API_KEY is not set.");
    process.exit(1);
  }
}

async function resolveTestSuite(options: {
  testFile?: string;
  test?: string;
  testDir: string;
}) {
  if (options.testFile) {
    console.log(`Running single test file: ${options.testFile}`);
    try {
      const testCase = parseTestCase(options.testFile);
      return { name: "Single Test", testCases: [testCase] };
    } catch (e) {
      console.error(`Failed to parse test file: ${(e as Error).message}`);
      process.exit(1);
    }
  }

  if (options.test) {
    const query = options.test.toLowerCase();
    const all = await discoverTests(options.testDir);
    const matched = all.testCases.filter(
      (tc) =>
        tc.id.toLowerCase().includes(query) ||
        tc.title.toLowerCase().includes(query),
    );
    if (matched.length === 0) {
      console.error(
        `No tests matching "${options.test}" found in ${options.testDir}`,
      );
      process.exit(1);
    }
    console.log(
      `Running ${matched.length} test(s) matching "${options.test}":`,
    );
    matched.forEach((tc) => console.log(`  - ${tc.title} (${tc.id})`));
    return { name: `Filtered: ${options.test}`, testCases: matched };
  }

  console.log(`Discovering tests in: ${options.testDir}`);
  return discoverTests(options.testDir);
}

function printRunSummary(
  runResult: TestRunResult,
  regressionReport: RegressionReport,
  activeLessonCount: number,
): void {
  const { summary } = runResult;

  console.log("\n\x1b[1m--- TEST RUN SUMMARY ---\x1b[0m");
  console.log(`Run ID: ${runResult.runId}`);
  console.log(`Total: ${summary.total}`);
  console.log(`Passed: \x1b[32m${summary.passed}\x1b[0m`);
  console.log(`Failed: \x1b[31m${summary.failed}\x1b[0m`);
  if (summary.inconclusive > 0)
    console.log(`Inconclusive: \x1b[33m${summary.inconclusive}\x1b[0m`);
  if (summary.errors > 0)
    console.log(`Errors: \x1b[31m${summary.errors}\x1b[0m`);
  console.log(`Duration: ${(summary.duration / 1000).toFixed(2)}s`);

  if (regressionReport.regressions.length > 0) {
    console.log("\n\x1b[31m⚠️  REGRESSIONS DETECTED:\x1b[0m");
    regressionReport.regressions.forEach((r) => {
      console.log(
        `  - \x1b[1m${r.title}\x1b[0m: ${r.previousStatus} -> \x1b[31m${r.currentStatus}\x1b[0m`,
      );
      console.log(`    Details: ${r.details}`);
    });
  }

  if (regressionReport.improvements.length > 0) {
    console.log("\n\x1b[32m✨ IMPROVEMENTS DETECTED:\x1b[0m");
    regressionReport.improvements.forEach((i) => {
      console.log(
        `  - \x1b[1m${i.title}\x1b[0m: ${i.previousStatus} -> \x1b[32m${i.currentStatus}\x1b[0m`,
      );
    });
  }

  if (activeLessonCount > 0) {
    console.log(
      `\n\x1b[36mℹ️  Active failure lessons: ${activeLessonCount} (will be injected into next run)\x1b[0m`,
    );
  }
}

// --- Commands ---

const program = new Command();

program
  .name("adk-qa")
  .description("AI-powered QA automation tool")
  .version("0.1.0");

program
  .command("manual")
  .description("Run a manual QA task")
  .argument("<task>", "Description of the QA task to perform")
  .option("--url <url>", "Initial URL to start from")
  .action(async (task, options) => {
    requireApiKey();

    console.log(`Starting manual QA task: "${task}"`);
    if (options.url) console.log(`Starting URL: ${options.url}`);

    const runner = createRunner(config);
    const browser = getBrowserManager();

    try {
      await browser.launch(config.headless);

      const session = await runner.sessionService.createSession({
        appName: "adk-qa",
        userId: "cli",
        state: {
          task_steps: task,
          url_hint: options.url || "",
          expected_criteria: "Task completed successfully",
        },
      });

      console.log(`Session created: ${session.id}`);

      for await (const event of runner.runAsync({
        userId: "cli",
        sessionId: session.id,
        newMessage: {
          role: "user",
          parts: [
            {
              text: `Execute this QA task: ${task}\nTarget URL: ${options.url || "See task description"}`,
            },
          ],
        },
      })) {
        if (event.author && event.author !== "user") {
          const text = stringifyContent(event);
          if (text) {
            console.log(
              `\x1b[36m[Agent: ${event.author}]\x1b[0m ${text.substring(0, 100)}${text.length > 100 ? "..." : ""}`,
            );
          }

          const functionCalls = getFunctionCalls(event);
          for (const call of functionCalls) {
            console.log(
              `  \x1b[33m[Tool: ${call.name}] calling with: ${JSON.stringify(call.args)}\x1b[0m`,
            );
          }
        }
      }

      const sessionDetails = await runner.sessionService.getSession({
        appName: "adk-qa",
        userId: "cli",
        sessionId: session.id,
      });
      const finalReport = sessionDetails?.state?.["final_report"];
      console.log("\n\x1b[1m--- FINAL REPORT ---\x1b[0m");
      console.log(
        typeof finalReport === "string" ? finalReport : "No report generated.",
      );
    } catch (error) {
      console.error("Task failed:", error);
    } finally {
      if (!config.headless) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      await browser.close();
    }
  });

program
  .command("auto")
  .description("Run automated test suites")
  .option("--test-dir <dir>", "Directory containing test files", config.testDir)
  .option("--test-file <file>", "Specific test file to run (exact path)")
  .option(
    "--test <name>",
    "Run test(s) matching name (partial, case-insensitive)",
  )
  .option("--auto-fix", "Automatically apply test definition corrections", false)
  .action(async (options) => {
    requireApiKey();

    const suite = await resolveTestSuite(options);

    if (suite.testCases.length === 0) {
      console.log("No tests found.");
      process.exit(0);
    }

    console.log(`Found ${suite.testCases.length} tests. Starting execution...`);
    console.log(
      `Models: navigator=${config.models.navigator}, validator=${config.models.validator}, reporter=${config.models.reporter}, evaluator=${config.models.evaluator}`,
    );

    let exitCode = 0;
    try {
      const latestRun = runStore.getLatestRun();
      const runResult = await runTestSuite(suite, config, {
        autoFix: options.autoFix,
      });
      runStore.saveRun(runResult);

      const regressionReport = detectRegressions(runResult, latestRun);

      const markdownReport = formatMarkdownReport(runResult, regressionReport);
      const mdPath = reportWriter.writeMarkdownReport(
        markdownReport,
        runResult.runId,
      );
      const jsonPath = reportWriter.writeJsonReport(runResult);
      console.log(`Reports: ${mdPath}, ${jsonPath}`);

      const activeLessonCount = suite.testCases.reduce((count, testCase) => {
        return count + lessonStore.getActiveLessons(testCase.id).length;
      }, 0);

      printRunSummary(runResult, regressionReport, activeLessonCount);

      exitCode =
        runResult.summary.failed > 0 || regressionReport.regressions.length > 0
          ? 1
          : 0;
    } catch (error) {
      console.error("Test run failed:", error);
      exitCode = 1;
    } finally {
      await getBrowserManager().close();
    }
    process.exit(exitCode);
  });

program.parse();
