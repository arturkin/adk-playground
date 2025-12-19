import puppeteer, { Browser, Page } from "puppeteer";

let browser: Browser | null = null;
let page: Page | null = null;

export async function launchBrowser() {
  const isCI = process.env.CI === "true";
  const isHeadless = isCI || process.env.HEADLESS === "true";

  browser = await puppeteer.launch({
    headless: isHeadless,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: null,
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
}

export async function getPage() {
  if (!page) throw new Error("Browser not initialized");
  return page;
}

export async function findElement(selector: string) {
  if (!page) throw new Error("Browser not initialized");
  try {
    return await page.waitForSelector(selector, { timeout: 5000 });
  } catch {
    return null;
  }
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

export async function clickElement(selector: string) {
  if (!page) throw new Error("Browser not initialized");
  try {
    const element = await page.waitForSelector(selector, { timeout: 5000 });
    if (!element) throw new Error(`Element not found: ${selector}`);
    await element.click();
  } catch (e) {
    throw new Error(
      `Failed to click element ${selector}: ${(e as Error).message}`,
    );
  }
}

export async function inputText(selector: string, text: string) {
  if (!page) throw new Error("Browser not initialized");
  try {
    const element = await page.waitForSelector(selector, { timeout: 5000 });
    if (!element) throw new Error(`Element not found: ${selector}`);
    await element.type(text);
  } catch (e) {
    throw new Error(
      `Failed to input text into ${selector}: ${(e as Error).message}`,
    );
  }
}
