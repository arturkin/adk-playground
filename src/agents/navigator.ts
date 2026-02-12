import { LlmAgent, LoopAgent } from '@google/adk';
import { type AppConfig } from '../config/schema.js';
import * as tools from '../tools/index.js';
import { injectScreenshotCallback } from './callbacks.js';

export function buildNavigatorAgent(config: AppConfig) {
  const navigator = new LlmAgent({
    name: 'navigator',
    model: config.models.navigator,
    instruction: `You are a QA automation expert. Your goal is to complete the assigned test steps sequentially.
    
    Test steps to execute:
    {task_steps}
    
    URL Hint (if applicable): {url_hint}

    Guidelines:
    1. Use the provided tools to interact with the web page.
    2. After each action, you will receive a new screenshot showing the updated state.
    3. Elements on the screenshot are tagged with red boxes and numerical IDs.
    4. Use these IDs to click or type into elements.
    5. If a step fails, try to understand why and correct your approach.
    6. When ALL steps are completed successfully, call the 'task_completed' tool.
    7. Be precise and avoid unnecessary steps.`,
    tools: [
      tools.navigateTool, 
      tools.scrollTool, 
      tools.clickElementTool, 
      tools.typeElementTool, 
      tools.pressKeyTool, 
      tools.taskCompletedTool
    ],
    outputKey: 'navigation_result',
    beforeModelCallback: injectScreenshotCallback,
  });

  return new LoopAgent({
    name: 'navigator_loop',
    subAgents: [navigator],
    maxIterations: config.maxNavigationIterations,
  });
}
