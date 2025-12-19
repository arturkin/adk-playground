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
