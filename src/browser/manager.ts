import puppeteer, { Browser, Page } from "puppeteer";
import { ViewportConfig } from "../types/browser.js";

export class BrowserManager {
  private static instance: BrowserManager;
  private browser: Browser | null = null;
  private page: Page | null = null;
  private viewport: ViewportConfig;

  private constructor(viewport: ViewportConfig = { name: "desktop", width: 1280, height: 1000 }) {
    this.viewport = viewport;
  }

  public static getInstance(viewport?: ViewportConfig): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager(viewport);
    } else if (viewport) {
      // If a new viewport is requested, we update the config.
      // If browser is already running, we might need to resize existing page.
      BrowserManager.instance.viewport = viewport;
    }
    return BrowserManager.instance;
  }

  public async launch(headless: boolean = true): Promise<{ browser: Browser; page: Page }> {
    if (this.browser) {
      // Ensure page matches current viewport if it was changed
      if (this.page) {
        await this.page.setViewport({ width: this.viewport.width, height: this.viewport.height });
      }
      return { browser: this.browser, page: this.page! };
    }

    this.browser = await puppeteer.launch({
      headless: headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--single-process",
        `--window-size=${this.viewport.width},${this.viewport.height}`,
      ],
      defaultViewport: { width: this.viewport.width, height: this.viewport.height },
    });

    this.page = await this.browser.newPage();
    return { browser: this.browser, page: this.page };
  }

  public async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  public getPage(): Page {
    if (!this.page) {
      throw new Error("Browser not initialized. Call launch() first.");
    }
    return this.page;
  }

  public getBrowser(): Browser {
    if (!this.browser) {
      throw new Error("Browser not initialized. Call launch() first.");
    }
    return this.browser;
  }
}

export const getBrowserManager = (viewport?: ViewportConfig) => BrowserManager.getInstance(viewport);
