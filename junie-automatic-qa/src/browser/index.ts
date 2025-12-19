import puppeteer, { Browser, Page } from "puppeteer";

let browser: Browser | null = null;
let page: Page | null = null;

export async function launchBrowser() {
  const isCI = process.env.CI === "true";
  const isHeadless = isCI || process.env.HEADLESS === "true";
  const width = 1280;
  const height = 1000;

  browser = await puppeteer.launch({
    headless: isHeadless,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--single-process",
      `--window-size=${width},${height}`,
    ],
    defaultViewport: { width, height },
  });

  page = await browser.newPage();
  return { browser, page };
}

export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }
}

export async function navigateTo(url: string) {
  if (!page) throw new Error("Browser not initialized");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise((resolve) => setTimeout(resolve, 5000));
}

export async function scrollPage(direction: "up" | "down" | "bottom" | "top") {
  if (!page) throw new Error("Browser not initialized");
  await page.evaluate((dir) => {
    if (dir === "down") window.scrollBy(0, window.innerHeight);
    else if (dir === "up") window.scrollBy(0, -window.innerHeight);
    else if (dir === "bottom") window.scrollTo(0, document.body.scrollHeight);
    else if (dir === "top") window.scrollTo(0, 0);
  }, direction);
}

export async function clickAt(x: number, y: number) {
  if (!page) throw new Error("Browser not initialized");
  await page.mouse.click(x, y);
}

export async function tagElements() {
  if (!page) throw new Error("Browser not initialized");
  return await page.evaluate(() => {
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
    document.querySelectorAll(".ai-label").forEach((el) => el.remove());

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
      '[role="checkbox"]',
      '[role="radio"]',
      "label[for]",
      "[onclick]",
      "[class^=ContentDropdown]",
    ].join(",");

    const elements = Array.from(document.querySelectorAll(selectors));

    // 3. Filter visible elements only
    const visibleElements = elements.filter((el) => {
      const rect = el.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
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

      // Create the visual label
      const label = document.createElement("div");
      label.className = "ai-label";
      label.innerText = id.toString();
      Object.assign(label.style, {
        position: "absolute",
        left: `${rect.left + window.scrollX}px`,
        top: `${rect.top + window.scrollY}px`,
        zIndex: "10000",
        backgroundColor: "#FF0000",
        color: "#FFFFFF",
        padding: "2px 4px",
        fontSize: "12px",
        fontWeight: "bold",
        border: "1px solid white",
        borderRadius: "3px",
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
  });
}

export async function clickElement(id: number) {
  if (!page) throw new Error("Browser not initialized");
  await page.evaluate((id) => {
    const el = (window as any).aiElementMap[id];
    if (!el) throw new Error(`Element ${id} not found`);
    el.click();
  }, id);
}

export async function typeElement(id: number, text: string) {
  if (!page) throw new Error("Browser not initialized");
  await page.evaluate(
    ({ id, text }) => {
      const el = (window as any).aiElementMap[id];
      if (!el) throw new Error(`Element ${id} not found`);
      el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { id, text },
  );
}

export async function getScreenshot() {
  if (!page) throw new Error("Browser not initialized");

  // Compress image (JPEG, quality 80)
  const buffer = await page.screenshot({
    type: "jpeg",
    quality: 80,
    encoding: "base64",
  });

  return buffer as string;
}

export async function typeText(text: string) {
  if (!page) throw new Error("Browser not initialized");
  await page.keyboard.type(text);
}

export async function pressKey(key: string) {
  if (!page) throw new Error("Browser not initialized");
  await page.keyboard.press(key as any);
}
