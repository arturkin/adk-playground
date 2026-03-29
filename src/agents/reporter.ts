import { LlmAgent } from "@google/adk";
import { type AppConfig } from "../config/schema.js";
import { recordBugTool } from "../tools/index.js";
import { emptyResponseNudgeCallback } from "./callbacks.js";

export function buildReporterAgent(config: AppConfig) {
  return new LlmAgent({
    name: "reporter",
    model: config.models.reporter,
    instruction: `TODAY'S DATE: ${new Date().toISOString().split("T")[0]}

TASK: Generate a structured QA report from the following inputs and record any discovered bugs.

KNOWLEDGE BASE:
{knowledge_base}

Navigation Result: {navigation_result}
Validation Result: {validation_result}
Test Assertions: {test_assertions}
Step Assertions: {step_assertions}

IMPORTANT: You only have access to the 'record_bug' tool. Do NOT attempt to call 'record_assertion' or any other tool — they are not available to you.

<process>
1. Analyze all inputs.
2. If any bugs or discrepancies found → call record_bug for each with appropriate severity BEFORE writing the report.
3. Write the structured report.
</process>

<output_contract>
Report format (plain text, formatted for an engineering team):

VERDICT: [PASS | FAIL | INCONCLUSIVE]

SUMMARY:
[One paragraph: what was tested — URL, key actions taken]

ASSERTION RESULTS:
[For each assertion (step-level and final): ID, description, passed/failed, evidence]

BUGS:
[List of bugs recorded via record_bug, or "None" if all passed]

RECOMMENDATIONS:
[Any observations or suggestions for test improvement]
</output_contract>

<conditional_logic>
- If validation_result contains PASS and all assertions passed → VERDICT: PASS.
- If ANY assertion failed or validation_result contains FAIL → VERDICT: FAIL.
- If validation_result contains INCONCLUSIVE or data is insufficient → VERDICT: INCONCLUSIVE.
- If bugs found → call record_bug for each BEFORE writing report text.
</conditional_logic>

<error_handling>
- If navigation_result is empty or missing → note in report: "Navigation data unavailable." VERDICT: INCONCLUSIVE.
- If test_assertions is empty → note: "No assertions defined." VERDICT: INCONCLUSIVE.
- If validation_result conflicts with assertion data → flag the discrepancy in RECOMMENDATIONS.
</error_handling>`,
    tools: [recordBugTool],
    outputKey: "final_report",
    generateContentConfig: {
      thinkingConfig: { thinkingBudget: config.thinkingBudgets.reporter },
    },
    afterModelCallback: emptyResponseNudgeCallback,
  });
}
