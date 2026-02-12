import {type ToolContext} from '@google/adk';
import {tagElements, getScreenshot, getBrowserManager} from '../browser/index.js';

/**
 * Helper to capture state after a browser action.
 * Cycles through 3 positioning modes (top-left, top-right, bottom-left) to avoid label occlusion.
 * It takes a screenshot and extracts interactive elements, saving them to session state.
 *
 * @param toolContext - The ADK tool context to access and update state.
 * @returns The number of interactive elements found.
 */
export async function captureBrowserState(toolContext: ToolContext): Promise<number> {
    // Wait for UI stabilization (CSS transitions, framework render cycles)
    await new Promise(resolve => setTimeout(resolve, 3000));

    const stepCount = Number(toolContext.state.get('step_count') || 0);

    try {
        const elements = await tagElements(stepCount);
        const screenshot = await getScreenshot();

        // Log current URL and element summary for debugging
        try {
            const page = await getBrowserManager().getActivePage();
            console.log(`    \x1b[34m[capture]\x1b[0m URL: ${page.url()} | Elements: ${elements.length} | Step: ${stepCount}`);
            // Log a summary of element types
            const tagCounts: Record<string, number> = {};
            for (const el of elements) {
                tagCounts[el.tagName] = (tagCounts[el.tagName] || 0) + 1;
            }
            console.log(`    \x1b[34m[capture]\x1b[0m Element breakdown: ${JSON.stringify(tagCounts)}`);
        } catch { /* ignore logging errors */
        }

        toolContext.state.set('latest_screenshot', screenshot);
        toolContext.state.set('latest_elements', JSON.stringify(elements));
        toolContext.state.set('step_count', String(stepCount + 1));

        return elements.length;
    } catch (e) {
        console.warn(`    \x1b[31m[capture failed]\x1b[0m ${(e as Error).message}. Returning 0 elements to allow loop to continue.`);
        // If capture failed, we don't update latest_screenshot/elements,
        // which might lead to a loop, but at least we don't crash the tool.
        // Ideally we should at least clear them or set a "loading" state.
        return 0;
    }
}
