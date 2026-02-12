import { type ToolContext } from '@google/adk';
import { tagElements, getScreenshot } from '../browser/index.js';

/**
 * Helper to capture state after a browser action.
 * Cycles through 3 positioning modes (top-left, top-right, bottom-left) to avoid label occlusion.
 */
export async function captureBrowserState(toolContext: ToolContext): Promise<number> {
  const stepCount = Number(toolContext.state.get('temp:step_count') || 0);
  const elements = await tagElements(stepCount);
  const screenshot = await getScreenshot();

  toolContext.state.set('temp:latest_screenshot', screenshot);
  toolContext.state.set('temp:latest_elements', JSON.stringify(elements));
  toolContext.state.set('temp:step_count', String(stepCount + 1));

  return elements.length;
}
