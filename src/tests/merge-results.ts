/**
 * CLI script to merge per-shard test result JSON files into a single run report.
 * Used by the CI merge job after all matrix shards complete.
 *
 * Usage: bun src/tests/merge-results.ts --results-dir <dir> [--output-dir <dir>]
 *
 * Reads all *.json files in --results-dir (except latest.json), merges them,
 * then writes the combined report and saves to run store.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { type TestRunResult, type TestCaseResult } from "../types/report.js";
import { formatMarkdownReport, reportWriter } from "../reports/index.js";
import { runStore, detectRegressions } from "../memory/index.js";
import { log } from "../logger/index.js";

function parseArgs(): { resultsDir: string } {
  const args = process.argv.slice(2);
  let resultsDir = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--results-dir" && args[i + 1]) {
      resultsDir = args[i + 1];
      i++;
    }
  }

  if (!resultsDir) {
    process.stderr.write(
      "Usage: bun src/tests/merge-results.ts --results-dir <dir>\n",
    );
    process.exit(1);
  }

  return { resultsDir };
}

async function main(): Promise<void> {
  const { resultsDir } = parseArgs();

  const files = fs
    .readdirSync(resultsDir)
    .filter(
      (f) =>
        f.endsWith(".json") &&
        f !== "latest.json" &&
        !f.startsWith("."),
    )
    .map((f) => path.join(resultsDir, f));

  if (files.length === 0) {
    log.error(`No result JSON files found in: ${resultsDir}`);
    process.exit(1);
  }

  log.info(`Merging ${files.length} shard result(s) from: ${resultsDir}`);

  const shardResults: TestRunResult[] = files.map((f) => {
    const raw = fs.readFileSync(f, "utf-8");
    return JSON.parse(raw) as TestRunResult;
  });

  // Use the earliest runId/timestamp as the combined run identity
  shardResults.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const base = shardResults[0];
  const allResults: TestCaseResult[] = shardResults.flatMap(
    (r) => r.results,
  );

  // Sort by testId for deterministic output
  allResults.sort((a, b) => a.testId.localeCompare(b.testId));

  const passed = allResults.filter((r) => r.status === "passed").length;
  const failed = allResults.filter((r) => r.status === "failed").length;
  const inconclusive = allResults.filter(
    (r) => r.status === "inconclusive",
  ).length;
  const errors = allResults.filter((r) => r.status === "error").length;
  const totalDuration = shardResults.reduce(
    (sum, r) => sum + r.summary.duration,
    0,
  );

  let gitCommit: string | undefined;
  try {
    gitCommit = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch {
    gitCommit = base.gitCommit;
  }

  const merged: TestRunResult = {
    runId: base.runId,
    timestamp: base.timestamp,
    gitCommit,
    modelConfig: base.modelConfig,
    results: allResults,
    summary: {
      total: allResults.length,
      passed,
      failed,
      inconclusive,
      errors,
      duration: totalDuration,
    },
  };

  const latestRun = runStore.getLatestRun();
  const regressionReport = detectRegressions(merged, latestRun);

  const markdownReport = formatMarkdownReport(merged, regressionReport);
  const mdPath = reportWriter.writeMarkdownReport(markdownReport, merged.runId);
  const jsonPath = reportWriter.writeJsonReport(merged);
  runStore.saveRun(merged);

  log.info(`Reports written: ${mdPath}, ${jsonPath}`);
  log.info(
    `Summary: total=${merged.summary.total} passed=${passed} failed=${failed} inconclusive=${inconclusive} errors=${errors}`,
  );

  // Write to GitHub Actions step summary if available
  const summaryPath = process.env["GITHUB_STEP_SUMMARY"];
  if (summaryPath) {
    fs.appendFileSync(summaryPath, markdownReport);
  }

  if (regressionReport.regressions.length > 0) {
    log.error(
      `${regressionReport.regressions.length} regression(s) detected — see report for details`,
    );
  }

  process.exit(merged.summary.failed > 0 || regressionReport.regressions.length > 0 ? 1 : 0);
}

main();
