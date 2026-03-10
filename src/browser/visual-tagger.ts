import { Page } from "puppeteer";
import { robustEvaluate } from "./utils.js";
import type { TextNodeMetadata } from "../types/browser.js";

type MarkerConfig = {
  borderColor: string;
  background: string;
  zIndex: string;
  className: string;
};

// Extend the global Window interface to avoid `as` casts in evaluate callbacks
declare global {
  interface Window {
    aiElementMap?: Record<number, Element>;
    _junie_open_patched?: boolean;
    _aiHelpersInjected?: boolean;
    _aiLabelPosition: (
      rect: DOMRect,
      renderIndex: number,
    ) => { left: number; top: number; transform: string };
    _aiAppendMarker: (
      rect: DOMRect,
      labelText: string,
      renderIndex: number,
      config: MarkerConfig,
    ) => void;
  }
}

/**
 * Injects shared DOM marker helper functions into the page window.
 * Idempotent — safe to call before each tagging pass.
 */
async function injectMarkerHelpers(page: Page) {
  await robustEvaluate(page, () => {
    if (window._aiHelpersInjected) return;

    window._aiLabelPosition = (rect, renderIndex) => {
      const posMode = renderIndex % 3;
      const labelHeightApprox = 20;
      let left = rect.left + window.scrollX;
      let top = rect.top + window.scrollY;
      let transform = "translateY(-100%)";

      if (posMode === 0) {
        if (rect.top < labelHeightApprox) transform = "translateY(0)";
      } else if (posMode === 1) {
        left = rect.right + window.scrollX;
        transform = "translate(-100%, -100%)";
        if (rect.top < labelHeightApprox) transform = "translate(-100%, 0)";
      } else if (posMode === 2) {
        top = rect.bottom + window.scrollY;
        transform = "translateY(0)";
        if (window.innerHeight - rect.bottom < labelHeightApprox)
          transform = "translateY(-100%)";
      }

      return { left, top, transform };
    };

    window._aiAppendMarker = (rect, labelText, renderIndex, config) => {
      const box = document.createElement("div");
      box.className = config.className;
      Object.assign(box.style, {
        position: "absolute",
        left: `${rect.left + window.scrollX}px`,
        top: `${rect.top + window.scrollY}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        border: `2px solid ${config.borderColor}`,
        backgroundColor: "transparent",
        zIndex: config.zIndex,
        pointerEvents: "none",
        boxSizing: "border-box",
      });
      document.body.appendChild(box);

      const { left, top, transform } = window._aiLabelPosition(
        rect,
        renderIndex,
      );

      const label = document.createElement("div");
      label.className = config.className;
      label.innerText = labelText;
      Object.assign(label.style, {
        position: "absolute",
        left: `${left}px`,
        top: `${top}px`,
        transform,
        zIndex: config.zIndex,
        backgroundColor: config.background,
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
    };

    window._aiHelpersInjected = true;
  });
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
 */
export async function tagElements(page: Page, renderIndex: number = 0) {
  await injectMarkerHelpers(page);

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

      const markerConfig: MarkerConfig = {
        borderColor: "#FF0000",
        background: "#FF0000",
        zIndex: "2147483647",
        className: "ai-marker",
      };

      visibleElements.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        const id = index + 1;

        window.aiElementMap![id] = el;
        window._aiAppendMarker(rect, id.toString(), renderIndex, markerConfig);

        let text =
          (el as HTMLElement).innerText ||
          (el as HTMLInputElement).value ||
          el.getAttribute("aria-label") ||
          "";
        text = text.slice(0, 100).replace(/\s+/g, " ").trim();

        const meta: (typeof elementMetadata)[number] = {
          id,
          tagName: el.tagName.toLowerCase(),
          text,
        };

        const role = el.getAttribute("role");
        if (role) meta.role = role;

        if (el.tagName === "A") {
          const href = el.getAttribute("href");
          if (href) meta.href = href.slice(0, 120);
        }

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

        const className = el.className;
        if (typeof className === "string" && className.length > 0) {
          meta.className = className.slice(0, 80);
        }

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
 * Must be called BEFORE tagElements() or after clearMarkers() to avoid overlap.
 */
export async function tagTextNodes(
  page: Page,
  renderIndex: number = 0,
): Promise<TextNodeMetadata[]> {
  await injectMarkerHelpers(page);

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

      // 3. Filter visible elements, deduplicating against already-tagged interactive elements
      const aiMap = window.aiElementMap ?? {};
      const interactiveElements = new Set(Object.values(aiMap));

      const visible = candidates.filter((el) => {
        const rect = el.getBoundingClientRect();
        if (
          rect.width <= 5 ||
          rect.height <= 5 ||
          window.getComputedStyle(el).visibility === "hidden" ||
          window.getComputedStyle(el).display === "none"
        ) {
          return false;
        }
        if (interactiveElements.has(el)) return false;
        for (const interactive of interactiveElements) {
          if (interactive.contains(el)) return false;
        }
        return true;
      });

      // 4. Filter by minimum text length
      const withText = visible.filter((el) => {
        const text = (el as HTMLElement).innerText?.trim() ?? "";
        return text.length >= 3;
      });

      // 5. Sort by priority: headings > labels > other
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

      // 6. Cap at 40 text nodes
      const capped = withText.slice(0, 40);

      const markerConfig: MarkerConfig = {
        borderColor: "#2196F3",
        background: "#2196F3",
        zIndex: "2147483646",
        className: "ai-text-marker",
      };

      const textMetadata: TextNodeMetadata[] = [];

      capped.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        const textId = `T${index + 1}`;

        window._aiAppendMarker(rect, textId, renderIndex, markerConfig);

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
