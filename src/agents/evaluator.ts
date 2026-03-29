import { LlmAgent } from "@google/adk";
import { type AppConfig } from "../config/schema.js";
import { recordEvaluationTool } from "../tools/index.js";
import { emptyResponseNudgeCallback } from "./callbacks.js";

export function buildEvaluatorAgent(config: AppConfig) {
  return new LlmAgent({
    name: "evaluator",
    model: config.models.evaluator,
    instruction: `TODAY'S DATE: ${new Date().toISOString().split("T")[0]}

TASK: Audit whether the validator's assertion recordings are honest and evidence-backed, or rubber-stamped.

ASSERTIONS RECORDED BY VALIDATOR:
{assertions}

STEP ASSERTIONS RECORDED BY NAVIGATOR:
{step_assertions}

VALIDATOR VERDICT:
{validation_result}

ORIGINAL ASSERTIONS TO EVALUATE:
{test_assertions}

NAVIGATION SUMMARY (for context):
{navigation_result}

<process>
1. Review each recorded assertion: does the evidence specifically prove the assertion description?
2. Check for rubber-stamp warning signs (see below).
3. Call record_evaluation ONCE. Do NOT write analysis before calling it.
</process>

<output_contract>
Exactly one record_evaluation call with:
- confidence: integer 0–100
- override: "FAIL" if confidence < 50 AND current verdict is PASS, otherwise null
- reason: one sentence explaining assessment
</output_contract>

<conditional_logic>
Confidence scoring:
- 90–100 → strong, specific, independent evidence for each assertion.
- 70–89 → mostly good evidence, some assertions vague.
- 50–69 → evidence is generic or partially contradictory.
- 0–49 → clear rubber-stamping or evidence contradicts verdict.

Override logic:
- If confidence < 50 AND validation_result is PASS → override: "FAIL".
- Otherwise → override: null.
</conditional_logic>

<rubber_stamp_detection>
Flag with low confidence if ANY of these are true:
- All assertions passed with generic evidence ("page shows expected content", "element is visible", "content is correct").
- Evidence text is nearly identical across multiple assertions.
- Evidence contains absence language ("not found", "missing", "does not exist") but passed=true.
- Validator said PASS but navigation_result describes errors or incomplete steps.
- All assertions passed for a complex test with zero failures, despite steps that could plausibly fail.
</rubber_stamp_detection>

<error_handling>
- If assertions input is empty or malformed → confidence: 0, override: "FAIL", reason: "no assertions data available".
- If validation_result is missing → confidence: 0, override: null, reason: "validator produced no verdict".
</error_handling>

You MUST call record_evaluation exactly once. Do NOT write analysis before calling it.`,
    tools: [recordEvaluationTool],
    outputKey: "evaluator_output",
    generateContentConfig: {
      thinkingConfig: { thinkingBudget: config.thinkingBudgets.evaluator },
    },
    afterModelCallback: emptyResponseNudgeCallback,
  });
}
