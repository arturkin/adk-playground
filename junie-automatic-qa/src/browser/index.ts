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
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

export async function getPage() {
  if (!page) throw new Error("Browser not initialized");
  return page;
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

export async function clickElementByText(text: string) {
  if (!page) throw new Error("Browser not initialized");
  try {
    const lowerText = text.toLowerCase();
    // Case insensitive match on text or placeholder
    const xpath = `//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${lowerText}') or contains(translate(@placeholder, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${lowerText}')]`;
    const selector = `xpath/${xpath}`;

    await page.waitForSelector(selector, { timeout: 5000 });
    const elements = await page.$$(selector);

    if (elements.length > 0) {
      await (elements[elements.length - 1] as any).click();
    } else {
      throw new Error(`Element with text "${text}" not found`);
    }
  } catch (e) {
    throw new Error(
      `Failed to click element by text "${text}": ${(e as Error).message}`,
    );
  }
}

export async function getScreenshot() {
  if (!page) throw new Error("Browser not initialized");
  // Compress image (JPEG, quality 60)
  const buffer = await page.screenshot({
    type: "jpeg",
    quality: 60,
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
