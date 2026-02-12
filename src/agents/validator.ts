import { LlmAgent } from '@google/adk';
import { type AppConfig } from '../config/schema.js';
import { takeScreenshotTool, recordAssertionTool } from '../tools/index.js';

export function buildValidatorAgent(config: AppConfig) {
  return new LlmAgent({
    name: 'validator',
    model: config.models.validator,
    instruction: `Review the navigation result: {navigation_result}
    Against expected criteria: {expected_criteria}
    
    Your task:
    1. Take a final screenshot if needed to verify the current state of the page.
    2. Check if the page state matches the expected outcome and specific assertions.
    3. Record each assertion using the 'record_assertion' tool.
    4. Provide a clear reasoning for your determination.
    
    Determine the overall result: PASS, FAIL, or INCONCLUSIVE.`,
    tools: [takeScreenshotTool, recordAssertionTool],
    outputKey: 'validation_result',
  });
}
