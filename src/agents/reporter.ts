import { LlmAgent } from "@google/adk";
import { type AppConfig } from "../config/schema.js";
import { recordBugTool } from "../tools/index.js";
import { emptyResponseNudgeCallback } from "./callbacks.js";

export function buildReporterAgent(config: AppConfig) {
  return new LlmAgent({
    name: "reporter",
    model: config.models.reporter,
    instruction: `Generate a structured QA report from the following inputs:
    
KNOWLEDGE BASE:
{knowledge_base}

Navigation Result: {navigation_result}
Validation Result: {validation_result}
Test Assertions: {test_assertions}
Step Assertions: {step_assertions}

IMPORTANT: You only have access to the 'record_bug' tool. Do NOT attempt to call 'record_assertion' or any other tool — they are not available to you.

Your task:
1. Start with a one-line VERDICT: PASS, FAIL, or INCONCLUSIVE.
2. Summarize what was tested (URL, key actions taken).
3. List each assertion and its result (passed/failed with evidence), including both step-level and final assertions.
4. If any bugs or discrepancies were found, record them using the 'record_bug' tool with appropriate severity.
5. End with any recommendations or observations.

Format the report for an engineering team.`,
    tools: [recordBugTool],
    outputKey: "final_report",
    generateContentConfig: {
      thinkingConfig: { thinkingBudget: config.thinkingBudgets.reporter },
    },
    afterModelCallback: emptyResponseNudgeCallback,
  });
}
