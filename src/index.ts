import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { Command } from "commander";
import { config } from "./config/index.js";
import { TEST_DIR } from "./constants.js";
import { createRunner, buildPlannerAgent } from "./agents/index.js";
import { getBrowserManager } from "./browser/index.js";
import { discoverTests } from "./tests/discovery.js";
import { runTestSuite, runTestSuiteParallel } from "./tests/runner.js";
import { parseTestCase } from "./tests/parser.js";
import {
  getFunctionCalls,
  stringifyContent,
  InMemoryRunner,
  LoopAgent,
} from "@google/adk";
import { runStore, detectRegressions, lessonStore } from "./memory/index.js";
import { formatMarkdownReport, reportWriter } from "./reports/index.js";
import type { TestRunResult, RegressionReport } from "./types/report.js";
import { setOutputDir, slugify } from "./tools/planning.js";
import { log, setVerbose } from "./logger/index.js";
import {
  resolveViewportSize,
  runCodegen,
  convertRecordingToTest,
  refineWithAnswers,
} from "./recorder/index.js";

// --- Helpers ---

function requireApiKey(): void {
  if (!config.apiKey) {
    log.error("GOOGLE_GENAI_API_KEY is not set.");
    process.exit(1);
  }
}

/**
 * Applies shard partitioning to a test suite.
 * --shard 1/3 returns the first third of tests, --shard 2/3 the second, etc.
 */
function applySharding<T>(
  items: T[],
  shardSpec: string,
): T[] {
  const match = /^(\d+)\/(\d+)$/.exec(shardSpec);
  if (!match) {
    log.error(
      `Invalid --shard format "${shardSpec}". Expected format: <index>/<total> (e.g. 1/3)`,
    );
    process.exit(1);
  }
  const index = parseInt(match[1], 10);
  const total = parseInt(match[2], 10);
  if (index < 1 || index > total) {
    log.error(
      `Invalid --shard "${shardSpec}": index must be between 1 and total`,
    );
    process.exit(1);
  }
  const chunkSize = Math.ceil(items.length / total);
  const start = (index - 1) * chunkSize;
  const end = Math.min(start + chunkSize, items.length);
  return items.slice(start, end);
}

async function resolveTestSuite(options: {
  testFile?: string;
  test?: string;
  testDir: string;
  shard?: string;
}) {
  if (options.testFile) {
    log.info(`Running single test file: ${options.testFile}`);
    try {
      const testCase = parseTestCase(options.testFile);
      return { name: "Single Test", testCases: [testCase] };
    } catch (e) {
      log.error(`Failed to parse test file: ${(e as Error).message}`);
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
      log.error(
        `No tests matching "${options.test}" found in ${options.testDir}`,
      );
      process.exit(1);
    }
    log.info(`Running ${matched.length} test(s) matching "${options.test}":`);
    matched.forEach((tc) => log.info(`  - ${tc.title} (${tc.id})`));
    return { name: `Filtered: ${options.test}`, testCases: matched };
  }

  log.info(`Discovering tests in: ${options.testDir}`);
  const suite = await discoverTests(options.testDir);

  if (options.shard) {
    const sharded = applySharding(suite.testCases, options.shard);
    log.info(
      `Shard ${options.shard}: running ${sharded.length}/${suite.testCases.length} test(s)`,
    );
    return { ...suite, testCases: sharded };
  }

  return suite;
}

function printRunSummary(
  runResult: TestRunResult,
  regressionReport: RegressionReport,
  activeLessonCount: number,
): void {
  const { summary } = runResult;

  log.info("\n--- TEST RUN SUMMARY ---");
  log.info(`Run ID: ${runResult.runId}`);
  log.info(`Total: ${summary.total}`);
  log.info(`Passed: ${summary.passed}`);
  log.info(`Failed: ${summary.failed}`);
  if (summary.inconclusive > 0)
    log.warn(`Inconclusive: ${summary.inconclusive}`);
  if (summary.errors > 0) log.error(`Errors: ${summary.errors}`);
  log.info(`Duration: ${(summary.duration / 1000).toFixed(2)}s`);

  if (regressionReport.regressions.length > 0) {
    log.error("\nREGRESSIONS DETECTED:");
    regressionReport.regressions.forEach((r) => {
      log.error(`  - ${r.title}: ${r.previousStatus} -> ${r.currentStatus}`);
      log.error(`    Details: ${r.details}`);
    });
  }

  if (regressionReport.improvements.length > 0) {
    log.info("\nIMPROVEMENTS DETECTED:");
    regressionReport.improvements.forEach((i) => {
      log.info(`  - ${i.title}: ${i.previousStatus} -> ${i.currentStatus}`);
    });
  }

  if (activeLessonCount > 0) {
    log.info(
      `\nActive failure lessons: ${activeLessonCount} (will be injected into next run)`,
    );
  }
}

async function readUserInput(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function handleRecording(
  url: string,
  options: { viewport: string; outputDir: string; title: string | undefined },
): Promise<void> {
  // Validate viewport early
  try {
    resolveViewportSize(options.viewport);
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const tempFile = path.join(os.tmpdir(), `adk-qa-recording-${Date.now()}.ts`);

  log.info("Recording started. Interact with the browser.");
  log.info(`Viewport: ${options.viewport} | URL: ${url}`);
  log.info("Press Ctrl+C or close the browser to stop recording.\n");

  let code = "";
  try {
    const result = await runCodegen(url, {
      viewport: options.viewport,
      outputFile: tempFile,
    });
    code = result.code;
  } finally {
    // Clean up temp file regardless of outcome
    try {
      fs.unlinkSync(tempFile);
    } catch {
      // File may not exist if codegen never wrote it
    }
  }

  if (!code.trim()) {
    log.error("No interactions recorded. Exiting.");
    return;
  }

  log.info("\nRecording captured. Converting to test format...");

  let result = await convertRecordingToTest(
    {
      playwrightCode: code,
      url,
      viewport: options.viewport,
      title: options.title,
    },
    config.apiKey,
    config.models.navigator,
  );

  if (result.questions && result.questions.length > 0) {
    log.info("\nThe following steps need clarification:");
    result.questions.forEach((q, i) => log.info(`  ${i + 1}. ${q}`));

    const answers = await readUserInput(
      "\nPlease answer the questions above: ",
    );

    result = await refineWithAnswers(
      result,
      answers,
      {
        playwrightCode: code,
        url,
        viewport: options.viewport,
        title: options.title,
      },
      config.apiKey,
      config.models.navigator,
    );
  }

  // Ensure output directory exists
  fs.mkdirSync(options.outputDir, { recursive: true });

  // Extract title from markdown (first H1 line) for filename
  const titleMatch = /^# (.+)$/m.exec(result.markdown);
  const testTitle = titleMatch
    ? titleMatch[1]
    : (options.title ?? "recorded-test");
  const filename = `${slugify(testTitle)}.md`;
  const filePath = path.resolve(options.outputDir, filename);

  fs.writeFileSync(filePath, result.markdown, "utf-8");

  // Validate the generated file
  try {
    const parsed = parseTestCase(filePath);
    log.info(`\nTest saved: ${filePath}`);
    log.info(`  Title: ${parsed.title}`);
    log.info(`  Steps: ${parsed.steps.length}`);
    log.info(`  Assertions: ${parsed.assertions.length}`);
  } catch (err) {
    log.warn(
      `Test saved to ${filePath}, but validation warning: ${err instanceof Error ? err.message : String(err)}`,
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
  .option("--cdp <endpoint>", "Connect to existing browser via CDP endpoint")
  .action(async (task, options) => {
    requireApiKey();

    log.info(`Starting manual QA task: "${task}"`);
    if (options.url) log.info(`Starting URL: ${options.url}`);

    const runner = createRunner(config);
    const browser = getBrowserManager();

    try {
      if (options.cdp) {
        await browser.connectCDP(options.cdp);
      } else {
        await browser.launch(config.headless);
      }

      const session = await runner.sessionService.createSession({
        appName: "adk-qa",
        userId: "cli",
        state: {
          task_steps: task,
          url_hint: options.url || "",
          expected_criteria: "Task completed successfully",
        },
      });

      log.info(`Session created: ${session.id}`);

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
            log.info(
              text.substring(0, 100) + (text.length > 100 ? "..." : ""),
              { agent: event.author },
            );
          }

          const functionCalls = getFunctionCalls(event);
          for (const call of functionCalls) {
            log.debug(`calling with: ${JSON.stringify(call.args)}`, {
              tool: call.name,
            });
          }
        }
      }

      const sessionDetails = await runner.sessionService.getSession({
        appName: "adk-qa",
        userId: "cli",
        sessionId: session.id,
      });
      const finalReport = sessionDetails?.state?.["final_report"];
      log.info("\n--- FINAL REPORT ---");
      log.info(
        typeof finalReport === "string" ? finalReport : "No report generated.",
      );
    } catch (error) {
      log.error(
        `Task failed: ${error instanceof Error ? error.message : String(error)}`,
      );
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
  .option("--test-dir <dir>", "Directory containing test files", TEST_DIR)
  .option("--test-file <file>", "Specific test file to run (exact path)")
  .option(
    "--test <name>",
    "Run test(s) matching name (partial, case-insensitive)",
  )
  .option(
    "--auto-fix",
    "Automatically apply test definition corrections",
    false,
  )
  .option("--cdp <endpoint>", "Connect to existing browser via CDP endpoint")
  .option(
    "--verbose",
    "Show all debug output (clicked elements, tool calls, captures)",
    false,
  )
  .option(
    "--concurrency <n>",
    "Number of tests to run in parallel (default: 1 = sequential)",
    "1",
  )
  .option(
    "--shard <index/total>",
    "Run only a partition of tests, e.g. --shard 1/3 runs the first third",
  )
  .action(async (options) => {
    requireApiKey();
    setVerbose(options.verbose);

    if (options.cdp) {
      config.cdpEndpoint = options.cdp;
    }

    const suite = await resolveTestSuite(options);

    if (suite.testCases.length === 0) {
      log.info("No tests found.");
      process.exit(0);
    }

    log.info(`Found ${suite.testCases.length} tests. Starting execution...`);
    log.info(
      `Models: navigator=${config.models.navigator}, validator=${config.models.validator}, reporter=${config.models.reporter}, evaluator=${config.models.evaluator}`,
    );

    let exitCode = 0;
    try {
      const concurrency = parseInt(options.concurrency ?? "1", 10);
      const latestRun = runStore.getLatestRun();
      const runResult =
        concurrency > 1
          ? await runTestSuiteParallel(suite, config, {
              autoFix: options.autoFix,
              concurrency,
            })
          : await runTestSuite(suite, config, {
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
      log.info(`Reports: ${mdPath}, ${jsonPath}`);

      const activeLessonCount = suite.testCases.reduce((count, testCase) => {
        return count + lessonStore.getActiveLessons(testCase.id).length;
      }, 0);

      printRunSummary(runResult, regressionReport, activeLessonCount);

      // Write GH Actions job summary
      const summaryPath = process.env["GITHUB_STEP_SUMMARY"];
      if (summaryPath) {
        fs.appendFileSync(summaryPath, markdownReport);
      }

      exitCode =
        runResult.summary.failed > 0 || regressionReport.regressions.length > 0
          ? 1
          : 0;
    } catch (error) {
      log.error(
        `Test run failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      exitCode = 1;
    } finally {
      await getBrowserManager().close();
      await log.flush();
    }
    process.exit(exitCode);
  });

program
  .command("generate")
  .description("Explore a URL and generate test cases")
  .argument("<url>", "URL to explore and generate tests for")
  .option(
    "--output-dir <dir>",
    "Output directory for generated tests",
    "./tests",
  )
  .option("--max-tests <n>", "Maximum test cases to generate", "5")
  .action(async (url, options) => {
    requireApiKey();

    const maxTests = parseInt(options.maxTests, 10);
    log.info(`Generating up to ${maxTests} test(s) for: ${url}`);
    log.info(`Output directory: ${options.outputDir}`);

    setOutputDir(options.outputDir);
    const planner = buildPlannerAgent(config, maxTests);
    const plannerLoop = new LoopAgent({
      name: "planner_loop",
      subAgents: [planner],
      maxIterations: config.maxNavigationIterations * 2,
    });
    const runner = new InMemoryRunner({
      agent: plannerLoop,
      appName: "adk-qa",
    });
    const browser = getBrowserManager();

    try {
      await browser.launch(config.headless);

      const session = await runner.sessionService.createSession({
        appName: "adk-qa",
        userId: "cli",
        state: {
          url_hint: url,
        },
      });

      for await (const event of runner.runAsync({
        userId: "cli",
        sessionId: session.id,
        newMessage: {
          role: "user",
          parts: [{ text: `Explore ${url} and generate test cases.` }],
        },
      })) {
        if (event.author && event.author !== "user") {
          const text = stringifyContent(event);
          if (text) {
            log.info(
              text.substring(0, 200) + (text.length > 200 ? "..." : ""),
              { agent: event.author },
            );
          }
          const functionCalls = getFunctionCalls(event);
          for (const call of functionCalls) {
            log.debug(JSON.stringify(call.args).substring(0, 100), {
              tool: call.name,
            });
          }
        }
      }

      log.info(
        `\nTest generation complete. Check ${options.outputDir} for generated test files.`,
      );
    } catch (error) {
      log.error(
        `Generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      await browser.close();
    }
  });

program
  .command("record")
  .description("Record browser interactions and generate a test case")
  .argument("<url>", "URL to start recording from")
  .option(
    "--viewport <preset>",
    "Viewport preset (desktop, mobile, mobile-pro, tablet)",
    "desktop",
  )
  .option(
    "--output-dir <dir>",
    "Output directory for generated test",
    "./tests",
  )
  .option("--title <title>", "Test title (auto-generated if not provided)")
  .action(async (url, options) => {
    requireApiKey();
    await handleRecording(url, {
      viewport: options.viewport,
      outputDir: options.outputDir,
      title: options.title,
    });
  });

program.parse();
