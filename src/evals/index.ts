import { config } from "../config/index.js";
import { getEvalDataset } from "./eval-dataset.js";
import { runTestCase } from "../tests/runner.js";
import { parseTestCase } from "../tests/parser.js";
import { createRunner } from "../agents/index.js";
import { EvalResult, EvalRunResult } from "./eval-types.js";

async function main() {
  console.log("🚀 Starting QA Agent Evaluation...");

  const evalCases = getEvalDataset();
  const runner = createRunner(config);
  const runId = `eval-${Date.now()}`;

  const results: EvalResult[] = [];

  for (const ec of evalCases) {
    console.log(
      `\nEvaluating: ${ec.testFilePath} (Expected: ${ec.expectedStatus.toUpperCase()})`,
    );
    try {
      const testCase = parseTestCase(ec.testFilePath);
      const result = await runTestCase(testCase, config, runner, runId);

      const isCorrect = result.status === ec.expectedStatus;

      results.push({
        testId: result.testId,
        title: result.title,
        expectedStatus: ec.expectedStatus,
        actualStatus: result.status,
        isCorrect,
      });

      if (isCorrect) {
        console.log(`✅ Correct verdict: ${result.status}`);
      } else {
        console.log(
          `❌ Incorrect verdict: ${result.status} (expected ${ec.expectedStatus})`,
        );
      }
    } catch (error) {
      console.error(`Error evaluating ${ec.testFilePath}:`, error);
    }
  }

  const evalRunResult: EvalRunResult = {
    total: results.length,
    correct: results.filter((r) => r.isCorrect).length,
    accuracy:
      (results.filter((r) => r.isCorrect).length / results.length) * 100,
    falsePositives: results.filter(
      (r) => r.expectedStatus === "failed" && r.actualStatus === "passed",
    ).length,
    falseNegatives: results.filter(
      (r) => r.expectedStatus === "passed" && r.actualStatus === "failed",
    ).length,
    results,
  };

  console.log("\n--- EVALUATION SUMMARY ---");
  console.log(
    `Accuracy: ${evalRunResult.accuracy.toFixed(2)}% (${evalRunResult.correct}/${evalRunResult.total})`,
  );
  console.log(
    `False Positives (Expected FAIL, got PASS): ${evalRunResult.falsePositives}`,
  );
  console.log(
    `False Negatives (Expected PASS, got FAIL): ${evalRunResult.falseNegatives}`,
  );

  if (evalRunResult.accuracy === 100) {
    console.log("\n🎉 Perfect Accuracy! All validation verdicts are correct.");
    process.exit(0);
  } else {
    console.log("\n⚠️ Some verdicts were incorrect.");
    process.exit(1);
  }
}

main();
