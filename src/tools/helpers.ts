import type { Context } from "@google/adk";
import {
  captureAccessibilitySnapshot,
  forceSingleTab,
  getScreenshot,
  getBrowserManager,
} from "../browser/index.js";

/**
 * Helper to capture state after a browser action.
 * Captures an accessibility snapshot (for the navigator LLM) and a clean
 * screenshot (for the validator LLM), saving them to session state.
 *
 * @param toolContext - The ADK tool context to access and update state.
 * @returns The number of interactive elements found.
 */
export async function captureBrowserState(
  toolContext: Context,
): Promise<number> {
  // Wait for UI stabilization (CSS transitions, framework render cycles)
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const stepCount = Number(toolContext.state.get("step_count") || 0);

  try {
    // Ensure single-tab behavior
    await forceSingleTab();

    // Capture accessibility snapshot (for navigator)
    // After the first capture, request incremental diffs to reduce token cost
    const useIncremental = stepCount > 0;
    const { elements, tree, isIncremental } =
      await captureAccessibilitySnapshot({ incremental: useIncremental });

    // Capture clean screenshot (for validator use later)
    const screenshot = await getScreenshot();

    const snapshotLabel = isIncremental
      ? tree === "(no changes)"
        ? "incremental (no changes)"
        : "incremental diff"
      : "full";
    console.log(
      `    \x1b[34m[capture]\x1b[0m Accessibility elements: ${elements.length} (${snapshotLabel})`,
    );

    // Log current URL and element summary for debugging
    try {
      const page = await getBrowserManager().getActivePage();
      console.log(
        `    \x1b[34m[capture]\x1b[0m URL: ${page.url()} | Elements: ${elements.length} | Step: ${stepCount}`,
      );
      // Log a summary of element roles (skip for no-change snapshots)
      if (elements.length > 0) {
        const roleCounts: Record<string, number> = {};
        for (const el of elements) {
          roleCounts[el.role] = (roleCounts[el.role] || 0) + 1;
        }
        console.log(
          `    \x1b[34m[capture]\x1b[0m Role breakdown: ${JSON.stringify(roleCounts)}`,
        );
      }
    } catch {
      /* ignore logging errors */
    }

    // For incremental no-change snapshots, keep previous state intact
    if (!(isIncremental && tree === "(no changes)")) {
      toolContext.state.set("latest_accessibility_tree", tree);
      toolContext.state.set("latest_elements", JSON.stringify(elements));
    }
    toolContext.state.set(
      "latest_snapshot_is_incremental",
      isIncremental ? "true" : "false",
    );
    toolContext.state.set("latest_screenshot", screenshot);
    toolContext.state.set("step_count", String(stepCount + 1));

    return elements.length;
  } catch (e) {
    console.warn(
      `    \x1b[31m[capture failed]\x1b[0m ${(e instanceof Error ? e : new Error(String(e))).message}. Returning 0 elements to allow loop to continue.`,
    );
    return 0;
  }
}
