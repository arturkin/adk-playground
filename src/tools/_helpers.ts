import { type ToolContext } from '@google/adk';
import { tagElements, getScreenshot } from '../browser/index.js';

/**
 * Helper to capture state after a browser action.
 * Cycles through 3 positioning modes (top-left, top-right, bottom-left) to avoid label occlusion.
 * It takes a screenshot and extracts interactive elements, saving them to session state.
 *
 * @param toolContext - The ADK tool context to access and update state.
 * @returns The number of interactive elements found.
 */
export async function captureBrowserState(toolContext: ToolContext): Promise<number> {
  const stepCount = Number(toolContext.state.get('step_count') || 0);
  const elements = await tagElements(stepCount);
  const screenshot = await getScreenshot();
  
  toolContext.state.set('latest_screenshot', screenshot);
  toolContext.state.set('latest_elements', JSON.stringify(elements));
  toolContext.state.set('step_count', String(stepCount + 1));

  return elements.length;
}
