import { LlmAgent } from "@google/adk";
import { type AppConfig } from "../config/schema.js";
import { recordEvaluationTool } from "../tools/index.js";
import { emptyResponseNudgeCallback } from "./callbacks.js";

export function buildEvaluatorAgent(config: AppConfig) {
  return new LlmAgent({
    name: "evaluator",
    model: config.models.evaluator,
    instruction: `You are a QA evaluation auditor. Your ONLY job is to assess whether the validator recorded honest, evidence-backed assertions or rubber-stamped the results.

ASSERTIONS RECORDED BY VALIDATOR:
{assertions}

VALIDATOR VERDICT:
{validation_result}

ORIGINAL ASSERTIONS TO EVALUATE:
{test_assertions}

NAVIGATION SUMMARY (for context):
{navigation_result}

RUBBER-STAMP WARNING SIGNS — flag these with low confidence or an override:
- All assertions passed with generic evidence ("page shows expected content", "element is visible", "content is correct")
- Evidence text is nearly identical across multiple assertions
- Evidence text contains absence language ("not found", "missing", "does not exist") but passed=true
- Validator said PASS but navigation_result describes errors or incomplete steps
- All assertions passed for a complex test with no failures at all, despite steps that could plausibly fail

YOUR TASK:
1. Review each recorded assertion: does the evidence specifically prove the assertion description?
2. Call record_evaluation ONCE with:
   - confidence: 0–100 (how confident you are the validator's verdict is correct)
     - 90–100: strong, specific, independent evidence for each assertion
     - 70–89: mostly good evidence but some assertions are vague
     - 50–69: evidence is generic or partially contradictory
     - 0–49: clear rubber-stamping or evidence contradicts the verdict
   - override: "FAIL" if confidence < 50 AND the current verdict is PASS, otherwise null
   - reason: one sentence explaining your assessment

You MUST call record_evaluation exactly once. Do NOT write analysis before calling it.`,
    tools: [recordEvaluationTool],
    outputKey: "evaluator_output",
    generateContentConfig: {
      thinkingConfig: { thinkingBudget: config.thinkingBudgets.evaluator },
    },
    afterModelCallback: emptyResponseNudgeCallback,
  });
}
