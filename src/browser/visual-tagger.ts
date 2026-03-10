import { Page } from "puppeteer";
import { robustEvaluate } from "./utils.js";
import type { TextNodeMetadata } from "../types/browser.js";

// Extend the global Window interface to avoid `as` casts in evaluate callbacks
declare global {
  interface Window {
    aiElementMap?: Record<number, Element>;
    _junie_open_patched?: boolean;
  }
}

/**
 * Removes all visual labels and bounding boxes from the page.
 */
export async function clearMarkers(page: Page) {
  return await robustEvaluate(page, () => {
    document
      .querySelectorAll(".ai-marker, .ai-label, .ai-text-marker")
      .forEach((el) => el.remove());
  });
}

/**
 * Injects visual labels and bounding boxes into the page for AI to identify elements.
 * Preserves the core Set-of-Mark logic from the original implementation.
 *
 * NOTE: Label positioning and marker DOM creation are intentionally inlined
 * (duplicated with tagTextNodes) because Puppeteer's page.evaluate serializes
 * functions and cannot share closures or helpers across separate evaluate calls.
 */
export async function tagElements(page: Page, renderIndex: number = 0) {
  return await robustEvaluate(
    page,
    (renderIndex: number) => {
      // FORCE SINGLE TAB: Remove target="_blank" from links to keep navigation in the same tab
      document.querySelectorAll("a[target]").forEach((el) => {
        if (el.getAttribute("target") === "_blank") {
          el.setAttribute("target", "_self");
        }
      });

      // FORCE SINGLE TAB: Monkey patch window.open
      if (!window._junie_open_patched) {
        window.open = (url) => {
          if (url) window.location.href = url.toString();
          return window;
        };
        window._junie_open_patched = true;
      }

      // 1. Clean up old tags if any exist
      document
        .querySelectorAll(".ai-marker, .ai-label")
        .forEach((el) => el.remove());

      // 2. Define interactable elements
      const selectors = [
        "button",
        "a",
        "input",
        "select",
        "textarea",
        '[role="button"]',
        '[role="link"]',
        '[role="menuitem"]',
        '[role="tab"]',
        '[role="option"]',
        '[role="checkbox"]',
        '[role="radio"]',
        "label[for]",
        "[onclick]",
        '[id^="react-select"]',
        "[class^='ContentDropdown']",
        "[class^='DayPicker-Day']",
      ].join(",");

      const elements = Array.from(document.querySelectorAll(selectors));

      // 3. Filter visible elements only
      const visibleElements = elements.filter((el) => {
        const rect = el.getBoundingClientRect();
        return (
          rect.width > 5 &&
          rect.height > 5 &&
          window.getComputedStyle(el).visibility !== "hidden" &&
          window.getComputedStyle(el).display !== "none"
        );
      });

      // 4. Create tags and store map
      window.aiElementMap = {};
      const elementMetadata: {
        id: number;
        tagName: string;
        text: string;
        role?: string;
        href?: string;
        type?: string;
        placeholder?: string;
        className?: string;
        ariaLabel?: string;
      }[] = [];

      visibleElements.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        const id = index + 1;

        // Store reference for clicking later
        window.aiElementMap![id] = el;

        // --- Create Bounding Box ---
        const box = document.createElement("div");
        box.className = "ai-marker";
        Object.assign(box.style, {
          position: "absolute",
          left: `${rect.left + window.scrollX}px`,
          top: `${rect.top + window.scrollY}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          border: "2px solid #FF0000",
          backgroundColor: "transparent",
          zIndex: "2147483647",
          pointerEvents: "none",
          boxSizing: "border-box",
        });
        document.body.appendChild(box);

        // --- Create Label ---
        const label = document.createElement("div");
        label.className = "ai-marker";
        label.innerText = id.toString();

        // Determine position based on renderIndex (Retry Logic)
        const posMode = renderIndex % 3;
        const labelHeightApprox = 20;

        let left = rect.left + window.scrollX;
        let top = rect.top + window.scrollY;
        let transform = "translateY(-100%)";

        if (posMode === 0) {
          if (rect.top < labelHeightApprox) {
            transform = "translateY(0)";
          }
        } else if (posMode === 1) {
          left = rect.right + window.scrollX;
          transform = "translate(-100%, -100%)";
          if (rect.top < labelHeightApprox) {
            transform = "translate(-100%, 0)";
          }
        } else if (posMode === 2) {
          top = rect.bottom + window.scrollY;
          transform = "translateY(0)";
          if (window.innerHeight - rect.bottom < labelHeightApprox) {
            transform = "translateY(-100%)";
          }
        }

        Object.assign(label.style, {
          position: "absolute",
          left: `${left}px`,
          top: `${top}px`,
          transform: transform,
          zIndex: "2147483647",
          backgroundColor: "#FF0000",
          color: "#FFFFFF",
          padding: "2px 4px",
          fontSize: "12px",
          fontWeight: "bold",
          border: "1px solid white",
          borderRadius: "2px",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        });
        document.body.appendChild(label);

        // Extract Metadata
        let text =
          (el as HTMLElement).innerText ||
          (el as HTMLInputElement).value ||
          el.getAttribute("aria-label") ||
          "";
        text = text.slice(0, 100).replace(/\s+/g, " ").trim();

        const meta: (typeof elementMetadata)[number] = {
          id: id,
          tagName: el.tagName.toLowerCase(),
          text: text,
        };

        // Add role if present
        const role = el.getAttribute("role");
        if (role) meta.role = role;

        // Add href for links
        if (el.tagName === "A") {
          const href = el.getAttribute("href");
          if (href) meta.href = href.slice(0, 120);
        }

        // Add type and placeholder for inputs
        if (
          el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT"
        ) {
          const type = el.getAttribute("type");
          if (type) meta.type = type;
          const placeholder = el.getAttribute("placeholder");
          if (placeholder) meta.placeholder = placeholder.slice(0, 80);
        }

        // Add truncated className for component recognition
        const className = el.className;
        if (typeof className === "string" && className.length > 0) {
          meta.className = className.slice(0, 80);
        }

        // Add aria-label if different from text
        const ariaLabel = el.getAttribute("aria-label");
        if (ariaLabel && ariaLabel !== text) {
          meta.ariaLabel = ariaLabel.slice(0, 80);
        }

        elementMetadata.push(meta);
      });

      return elementMetadata;
    },
    renderIndex,
  );
}

/**
 * Tags non-interactive text nodes with blue bounding boxes so the AI agent
 * can read labels, headings, and other contextual text near interactive elements.
 * Called separately from tagElements() — each gets its own screenshot to avoid label overlap.
 *
 * NOTE: Label positioning and marker DOM creation are intentionally inlined
 * (duplicated with tagElements) because Puppeteer's page.evaluate serializes
 * functions and cannot share closures or helpers across separate evaluate calls.
 */
export async function tagTextNodes(
  page: Page,
  renderIndex: number = 0,
): Promise<TextNodeMetadata[]> {
  return await robustEvaluate(
    page,
    (renderIndex: number): TextNodeMetadata[] => {
      // 1. Clean up old text markers
      document
        .querySelectorAll(".ai-text-marker")
        .forEach((el) => el.remove());

      // 2. Candidate text selectors
      const selectors = [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "label",
        "p",
        "span",
        "td",
        "th",
        "li",
        "legend",
        "figcaption",
        '[role="heading"]',
        "dt",
        "dd",
        "caption",
      ].join(",");

      const candidates = Array.from(document.querySelectorAll(selectors));

      // 3. Exclude text nodes inside interactive elements (already covered by tagElements)
      const interactiveSelectors =
        "a, button, input, select, textarea, " +
        '[role="button"], [role="link"], [role="menuitem"], [role="tab"], ' +
        '[role="option"], [role="checkbox"], [role="radio"], [onclick]';
      const nonInteractive = candidates.filter((el) => {
        // Skip elements inside interactive containers
        if (el.closest(interactiveSelectors)) return false;
        // Skip label[for] — these describe form controls already covered by tagElements
        if (el.tagName === "LABEL" && el.hasAttribute("for")) return false;
        return true;
      });

      // 4. Filter visible elements
      const visible = nonInteractive.filter((el) => {
        const rect = el.getBoundingClientRect();
        return (
          rect.width > 5 &&
          rect.height > 5 &&
          window.getComputedStyle(el).visibility !== "hidden" &&
          window.getComputedStyle(el).display !== "none"
        );
      });

      // 5. Filter by minimum text length
      const withText = visible.filter((el) => {
        const text = (el as HTMLElement).innerText?.trim() ?? "";
        return text.length >= 2;
      });

      // 6. Sort by priority: headings > labels > other
      const headingTags = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
      withText.sort((a, b) => {
        const aTag = a.tagName.toLowerCase();
        const bTag = b.tagName.toLowerCase();
        const aIsHeading =
          headingTags.has(aTag) || a.getAttribute("role") === "heading";
        const bIsHeading =
          headingTags.has(bTag) || b.getAttribute("role") === "heading";
        const aIsLabel = aTag === "label";
        const bIsLabel = bTag === "label";
        if (aIsHeading && !bIsHeading) return -1;
        if (!aIsHeading && bIsHeading) return 1;
        if (aIsLabel && !bIsLabel) return -1;
        if (!aIsLabel && bIsLabel) return 1;
        return 0;
      });

      // 7. Cap at 80 text nodes
      const capped = withText.slice(0, 80);

      const textMetadata: TextNodeMetadata[] = [];

      capped.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        const textId = `T${index + 1}`;

        // --- Create Blue Bounding Box ---
        const box = document.createElement("div");
        box.className = "ai-text-marker";
        Object.assign(box.style, {
          position: "absolute",
          left: `${rect.left + window.scrollX}px`,
          top: `${rect.top + window.scrollY}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          border: "2px solid #2196F3",
          backgroundColor: "transparent",
          zIndex: "2147483646",
          pointerEvents: "none",
          boxSizing: "border-box",
        });
        document.body.appendChild(box);

        // --- Create Blue Label ---
        const labelEl = document.createElement("div");
        labelEl.className = "ai-text-marker";
        labelEl.innerText = textId;

        const posMode = renderIndex % 3;
        const labelHeightApprox = 20;
        let left = rect.left + window.scrollX;
        let top = rect.top + window.scrollY;
        let transform = "translateY(-100%)";

        if (posMode === 1) {
          left = rect.right + window.scrollX;
          transform = "translate(-100%, -100%)";
          if (rect.top < labelHeightApprox) transform = "translate(-100%, 0)";
        } else if (posMode === 2) {
          top = rect.bottom + window.scrollY;
          transform = "translateY(0)";
          if (window.innerHeight - rect.bottom < labelHeightApprox)
            transform = "translateY(-100%)";
        } else {
          if (rect.top < labelHeightApprox) transform = "translateY(0)";
        }

        Object.assign(labelEl.style, {
          position: "absolute",
          left: `${left}px`,
          top: `${top}px`,
          transform: transform,
          zIndex: "2147483646",
          backgroundColor: "#2196F3",
          color: "#FFFFFF",
          padding: "2px 4px",
          fontSize: "12px",
          fontWeight: "bold",
          border: "1px solid white",
          borderRadius: "2px",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        });
        document.body.appendChild(labelEl);

        // Collect metadata
        const rawText = (el as HTMLElement).innerText?.trim() ?? "";
        const meta: TextNodeMetadata = {
          id: textId,
          tagName: el.tagName.toLowerCase(),
          text: rawText.slice(0, 120).replace(/\s+/g, " "),
        };

        const role = el.getAttribute("role");
        if (role) meta.role = role;

        const forAttr = el.getAttribute("for");
        if (forAttr) meta.forElement = forAttr;

        textMetadata.push(meta);
      });

      return textMetadata;
    },
    renderIndex,
  );
}
