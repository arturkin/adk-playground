import { describe, test, expect, beforeAll } from "bun:test";
import { JSDOM } from "jsdom";
import { readFileSync } from "fs";
import { resolve } from "path";
import type { TextNodeMetadata } from "../../types/browser.js";

/**
 * Mirrors the inner function of tagTextNodes in visual-tagger.ts.
 * Runs the same selector/filter/sort logic against any DOM document.
 *
 * NOTE: jsdom does not compute layout, so getBoundingClientRect() returns zeros.
 * We skip the visibility/size filter here and only test selector + text logic.
 */
function runTagTextNodesLogic(doc: Document): TextNodeMetadata[] {
  const selectors = [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "label", "p", "span", "td", "th", "li",
    "legend", "figcaption", '[role="heading"]',
    "dt", "dd", "caption",
  ].join(",");

  const candidates = Array.from(doc.querySelectorAll(selectors));

  // Exclude text nodes inside interactive elements (already covered by tagElements)
  const interactiveSelectors =
    "a, button, input, select, textarea, " +
    '[role="button"], [role="link"], [role="menuitem"], [role="tab"], ' +
    '[role="option"], [role="checkbox"], [role="radio"], [onclick]';
  const nonInteractive = candidates.filter((el) => {
    if (el.closest(interactiveSelectors)) return false;
    if (el.tagName === "LABEL" && el.hasAttribute("for")) return false;
    return true;
  });

  // jsdom has no layout engine, so skip getBoundingClientRect/visibility checks.
  // Filter only by text content (mirrors the withText filter in visual-tagger).
  const withText = nonInteractive.filter((el) => {
    const text = el.textContent?.trim() ?? "";
    return text.length >= 2;
  });

  const headingTags = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);
  withText.sort((a, b) => {
    const aTag = a.tagName;
    const bTag = b.tagName;
    const aIsHeading = headingTags.has(aTag) || a.getAttribute("role") === "heading";
    const bIsHeading = headingTags.has(bTag) || b.getAttribute("role") === "heading";
    const aIsLabel = aTag === "LABEL";
    const bIsLabel = bTag === "LABEL";
    if (aIsHeading && !bIsHeading) return -1;
    if (!aIsHeading && bIsHeading) return 1;
    if (aIsLabel && !bIsLabel) return -1;
    if (!aIsLabel && bIsLabel) return 1;
    return 0;
  });

  const capped = withText.slice(0, 80);

  return capped.map((el, index) => {
    const textId = `T${index + 1}`;
    const rawText = el.textContent?.trim() ?? "";
    const meta: TextNodeMetadata = {
      id: textId,
      tagName: el.tagName.toLowerCase(),
      text: rawText.slice(0, 120).replace(/\s+/g, " "),
    };
    const role = el.getAttribute("role");
    if (role) meta.role = role;
    const forAttr = el.getAttribute("for");
    if (forAttr) meta.forElement = forAttr;
    return meta;
  });
}

describe("tagTextNodes with mock-page.html", () => {
  let results: TextNodeMetadata[];

  beforeAll(() => {
    const htmlPath = resolve(import.meta.dir, "mock-page.html");
    const html = readFileSync(htmlPath, "utf-8");
    const dom = new JSDOM(html, { url: "https://localhost", runScripts: "outside-only" });
    results = runTagTextNodesLogic(dom.window.document as unknown as Document);
  });

  test("should return text nodes", () => {
    expect(results.length).toBeGreaterThan(0);
  });

  test('should find "Select dates" in a <p> tag', () => {
    const match = results.find((r) => r.text.includes("Select dates"));
    expect(match).toBeDefined();
    expect(match!.tagName).toBe("p");
  });

  test('should find "Choose your perfect Icelandic experience" in a <p> tag', () => {
    const match = results.find((r) =>
      r.text.includes("Choose your perfect Icelandic experience"),
    );
    expect(match).toBeDefined();
    expect(match!.tagName).toBe("p");
  });

  test('should find "Add travelers" in a <p> tag', () => {
    const match = results.find((r) => r.text.includes("Add travelers"));
    expect(match).toBeDefined();
    expect(match!.tagName).toBe("p");
  });

  test('should find "Book your complete trip with the best companies only" in a <p> tag', () => {
    const match = results.find((r) =>
      r.text.includes("Book your complete trip with the best companies only"),
    );
    expect(match).toBeDefined();
    expect(match!.tagName).toBe("p");
  });

  test("should have headings sorted before paragraphs", () => {
    const firstHeadingIdx = results.findIndex((r) =>
      ["h1", "h2", "h3", "h4", "h5", "h6"].includes(r.tagName),
    );
    const firstParagraphIdx = results.findIndex((r) => r.tagName === "p");

    if (firstHeadingIdx >= 0 && firstParagraphIdx >= 0) {
      expect(firstHeadingIdx).toBeLessThan(firstParagraphIdx);
    }
  });

  test("should cap results at 80 nodes", () => {
    expect(results.length).toBeLessThanOrEqual(80);
  });

  test("should use T-prefixed IDs", () => {
    for (const r of results) {
      expect(r.id).toMatch(/^T\d+$/);
    }
  });
});
