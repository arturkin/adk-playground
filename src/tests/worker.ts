/**
 * Worker entry point for parallel test execution.
 *
 * Usage: bun src/tests/worker.ts --test-file <path> --run-id <id>
 *
 * Outputs a single JSON line to stdout: { result: TestCaseResult, logs: LogEntry[] }
 * The parent process replays the logs as a contiguous block via its own logger.
 */

import { log } from "../logger/index.js";

// Switch to buffer-only mode before any other imports execute their module-level code.
// This captures all log output in memory instead of printing to the console.
log.setWorkerMode();

import { config } from "../config/index.js";
import { createRunner } from "../agents/index.js";
import { parseTestCase } from "./parser.js";
import { runTestCase } from "./runner.js";
import type { TestCaseResult } from "../types/report.js";
import type { LogEntry } from "../logger/index.js";

export interface WorkerResult {
  result: TestCaseResult;
  logs: LogEntry[];
}

function parseArgs(): { testFile: string; runId: string } {
  const args = process.argv.slice(2);
  let testFile = "";
  let runId = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--test-file" && args[i + 1]) {
      testFile = args[i + 1];
      i++;
    } else if (args[i] === "--run-id" && args[i + 1]) {
      runId = args[i + 1];
      i++;
    }
  }

  if (!testFile || !runId) {
    process.stderr.write(
      "Usage: bun src/tests/worker.ts --test-file <path> --run-id <id>\n",
    );
    process.exit(1);
  }

  return { testFile, runId };
}

async function main(): Promise<void> {
  const { testFile, runId } = parseArgs();

  let testCase;
  try {
    testCase = parseTestCase(testFile);
  } catch (e) {
    process.stderr.write(
      `Failed to parse test file "${testFile}": ${(e as Error).message}\n`,
    );
    process.exit(1);
  }

  const runner = createRunner(config);

  try {
    const result = await runTestCase(testCase, config, runner, runId, {
      skipLessons: true,
    });
    const logs = log.getBufferedLogs();
    const output: WorkerResult = { result, logs };
    process.stdout.write(JSON.stringify(output) + "\n");
    process.exit(0);
  } catch (e) {
    process.stderr.write(`Worker crashed: ${(e as Error).message}\n`);
    process.exit(1);
  }
}

main();
