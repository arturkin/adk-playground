import { LlmAgent } from '@google/adk';
import { type AppConfig } from '../config/schema.js';
import { recordBugTool } from '../tools/index.js';

export function buildReporterAgent(config: AppConfig) {
  return new LlmAgent({
    name: 'reporter',
    model: config.models.reporter,
    instruction: `Generate a structured QA report from the following inputs:
    
    Navigation Result: {navigation_result}
    Validation Result: {validation_result}
    
    Your task:
    1. Summarize the findings of the QA session.
    2. If any bugs or discrepancies were found, record them using the 'record_bug' tool.
    3. Provide a clear and concise final report for the engineering team.`,
    tools: [recordBugTool],
    outputKey: 'final_report',
  });
}
