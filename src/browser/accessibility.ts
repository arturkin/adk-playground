import type { Page } from "playwright";
import type { AccessibilityElement } from "../types/browser.js";

/**
 * Extend Playwright's Page with the private _snapshotForAI API.
 * This is used by @playwright/mcp internally and is not part of the public API.
 */
interface PageWithSnapshot extends Page {
  _snapshotForAI?: () => Promise<{ full: string }>;
}

/**
 * Extend the global Window interface for the single-tab enforcement patch.
 */
declare global {
  interface Window {
    _singleTabPatched?: boolean;
  }
}

/**
 * Represents the result of an accessibility snapshot capture.
 */
export interface AccessibilitySnapshot {
  /** Parsed elements with refs for structured lookup */
  elements: AccessibilityElement[];
  /** Raw YAML tree text for LLM consumption */
  tree: string;
}

/**
 * Captures an accessibility snapshot of the page using Playwright's internal
 * _snapshotForAI() API. Returns both the raw YAML tree (for the LLM) and
 * parsed elements with refs (for programmatic lookup).
 *
 * This uses the same API that @playwright/mcp uses internally.
 */
export async function captureAccessibilitySnapshot(
  page: PageWithSnapshot,
): Promise<AccessibilitySnapshot> {
  if (typeof page._snapshotForAI !== "function") {
    throw new Error(
      "Playwright _snapshotForAI() not available. Ensure you are using a compatible Playwright version.",
    );
  }

  const result = await page._snapshotForAI();
  const tree = result.full;
  const elements = parseAccessibilityTree(tree);

  return { elements, tree };
}

/**
 * Parses the YAML accessibility tree from _snapshotForAI into structured elements.
 *
 * Example input line:
 *   - button "Search Flights" [ref=e6] [cursor=pointer]
 *   - textbox "From" [ref=e7] value="New York"
 *   - heading "Welcome" [level=1] [ref=e3]
 *   - link "Home" [ref=e12] [cursor=pointer]:
 *       - /url: https://example.com
 */
function parseAccessibilityTree(tree: string): AccessibilityElement[] {
  const elements: AccessibilityElement[] = [];
  const lines = tree.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match lines with refs: "- role "name" [ref=xxx] ..."
    const refMatch = line.match(/\[ref=(e\d+)]/);
    if (!refMatch) continue;

    const ref = refMatch[1];

    // Extract role: first word after "- " (possibly with indentation)
    const roleMatch = line.match(/[-–]\s+(\w+)\s/);
    if (!roleMatch) continue;

    const role = roleMatch[1];

    // Extract name: quoted string after role
    const nameMatch = line.match(/[-–]\s+\w+\s+"([^"]*)"/);
    const name = nameMatch ? nameMatch[1] : "";

    const element: AccessibilityElement = { ref, role, name };

    // Extract value if present: value="..."
    const valueMatch = line.match(/value="([^"]*)"/);
    if (valueMatch) element.value = valueMatch[1];

    // Extract level if present: [level=N]
    const levelMatch = line.match(/\[level=(\d+)]/);
    if (levelMatch) element.level = parseInt(levelMatch[1], 10);

    // Extract checked state
    if (line.includes("[checked=true]") || line.includes("[checked]")) {
      element.checked = true;
    } else if (line.includes("[checked=false]")) {
      element.checked = false;
    } else if (line.includes("[checked=mixed]")) {
      element.checked = "mixed";
    }

    // Extract disabled state
    if (line.includes("[disabled]") || line.includes("[disabled=true]")) {
      element.disabled = true;
    }

    // Extract URL from next line if present: "- /url: ..."
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      const urlMatch = nextLine.match(/\/url:\s+(.+)/);
      if (urlMatch) element.url = urlMatch[1].trim();
    }

    elements.push(element);
  }

  return elements;
}

/**
 * Resolves an accessibility ref to a Playwright Locator.
 * Uses the aria-ref selector engine that Playwright provides internally.
 */
export function resolveRef(page: Page, ref: string) {
  return page.locator(`aria-ref=${ref}`);
}

/**
 * Forces single-tab navigation by patching window.open and removing target="_blank".
 * Migrated from the former visual-tagger.ts.
 */
export async function forceSingleTab(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Remove target="_blank" from links
    document.querySelectorAll("a[target]").forEach((el) => {
      if (el.getAttribute("target") === "_blank") {
        el.setAttribute("target", "_self");
      }
    });

    // Monkey-patch window.open to navigate in the same tab
    if (!window._singleTabPatched) {
      window.open = (url?: string | URL) => {
        if (url) window.location.href = url.toString();
        return window;
      };
      window._singleTabPatched = true;
    }
  });
}
