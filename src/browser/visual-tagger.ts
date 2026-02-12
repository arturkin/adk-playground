import { Page } from "puppeteer";

/**
 * Removes all visual labels and bounding boxes from the page.
 */
export async function clearMarkers(page: Page) {
  return await page.evaluate(() => {
    document
      .querySelectorAll(".ai-marker, .ai-label")
      .forEach((el) => el.remove());
  });
}

/**
 * Injects visual labels and bounding boxes into the page for AI to identify elements.
 * Preserves the core Set-of-Mark logic from the original implementation.
 */
export async function tagElements(page: Page, renderIndex: number = 0) {
  return await page.evaluate((renderIndex) => {
    // FORCE SINGLE TAB: Remove target="_blank" from links to keep navigation in the same tab
    document.querySelectorAll("a[target]").forEach((el) => {
      if (el.getAttribute("target") === "_blank") {
        el.setAttribute("target", "_self");
      }
    });

    // FORCE SINGLE TAB: Monkey patch window.open
    if (!(window as any)._junie_open_patched) {
      window.open = (url) => {
        if (url) window.location.href = url.toString();
        return window;
      };
      (window as any)._junie_open_patched = true;
    }

    // 1. Clean up old tags if any exist
    document
      .querySelectorAll(".ai-marker, .ai-label")
      .forEach((el) => el.remove());

    // 2. Define interactable elements
    const selectors = [
      "button",
      "a",
      "p",
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
    (window as any).aiElementMap = {}; // Global map to store references
    const elementMetadata: any[] = [];

    visibleElements.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      const id = index + 1;

      // Store reference for clicking later
      (window as any).aiElementMap[id] = el;

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
      // 0: Top-Left (Outside Above)
      // 1: Top-Right (Outside Above)
      // 2: Bottom-Left (Outside Below)
      const posMode = renderIndex % 3;
      const labelHeightApprox = 20;

      let left = rect.left + window.scrollX;
      let top = rect.top + window.scrollY;
      let transform = "translateY(-100%)"; // Default: Move up

      if (posMode === 0) {
        // Top-Left Outside
        // Fallback: If at very top, move inside
        if (rect.top < labelHeightApprox) {
          transform = "translateY(0)";
        }
      } else if (posMode === 1) {
        // Top-Right Outside
        left = rect.right + window.scrollX;
        // Shift left to align right edge, shift up to be outside
        transform = "translate(-100%, -100%)";
        if (rect.top < labelHeightApprox) {
          transform = "translate(-100%, 0)";
        }
      } else if (posMode === 2) {
        // Bottom-Left Outside
        top = rect.bottom + window.scrollY;
        transform = "translateY(0)"; // Already below
        // Fallback: If at very bottom, move inside (up)
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

      elementMetadata.push({
        id: id,
        tagName: el.tagName.toLowerCase(),
        text: text,
        role: el.getAttribute("role") || undefined,
      });
    });

    return elementMetadata;
  }, renderIndex);
}
