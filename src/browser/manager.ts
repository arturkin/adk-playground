import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import type { ViewportConfig } from "../types/browser.js";
import { USER_AGENT } from "../env.js";
import { resetSnapshotTracking } from "./accessibility.js";
import { log } from "../logger/index.js";

export type { Browser, BrowserContext, Page } from "playwright";

export class BrowserManager {
  private static instance: BrowserManager;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private viewport: ViewportConfig;

  private constructor(
    viewport: ViewportConfig = { name: "desktop", width: 1280, height: 1000 },
  ) {
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

  public async launch(
    headless: boolean = true,
  ): Promise<{ browser: Browser; page: Page }> {
    if (this.browser && this.browser.isConnected()) {
      // Ensure page matches current viewport if it was changed
      if (this.page) {
        await this.page.setViewportSize({
          width: this.viewport.width,
          height: this.viewport.height,
        });
      }
      return { browser: this.browser, page: this.page! };
    }

    // Clean up disconnected browser
    if (this.browser && !this.browser.isConnected()) {
      this.browser = null;
      this.context = null;
      this.page = null;
    }

    this.browser = await chromium.launch({
      headless: headless,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    this.context = await this.browser.newContext({
      viewport: {
        width: this.viewport.width,
        height: this.viewport.height,
      },
      userAgent: USER_AGENT ?? "Travelshift/QA",
    });

    // Single-tab enforcement: when a new page opens, close the old one and track the new one
    this.context.on("page", (newPage: Page) => {
      const oldPage = this.page;
      this.page = newPage;
      if (oldPage && oldPage !== newPage) {
        oldPage.close().catch(() => {
          // Ignore errors when closing the old page
        });
      }
    });

    this.page = await this.context.newPage();
    return { browser: this.browser, page: this.page };
  }

  public async connectCDP(
    endpoint: string,
  ): Promise<{ browser: Browser; page: Page }> {
    if (this.browser && this.browser.isConnected()) {
      if (this.page) {
        await this.page.setViewportSize({
          width: this.viewport.width,
          height: this.viewport.height,
        });
      }
      return { browser: this.browser, page: this.page! };
    }

    // Clean up disconnected browser
    if (this.browser && !this.browser.isConnected()) {
      this.browser = null;
      this.context = null;
      this.page = null;
    }

    this.browser = await chromium.connectOverCDP(endpoint, { isLocal: true });

    // Get existing context or create new one
    const contexts = this.browser.contexts();
    this.context =
      contexts.length > 0
        ? contexts[0]
        : await this.browser.newContext({
            viewport: {
              width: this.viewport.width,
              height: this.viewport.height,
            },
            userAgent: USER_AGENT ?? "Travelshift/QA",
          });

    // Single-tab enforcement
    this.context.on("page", (newPage: Page) => {
      const oldPage = this.page;
      this.page = newPage;
      if (oldPage && oldPage !== newPage) {
        oldPage.close().catch(() => {});
      }
    });

    // Get existing page or create new one
    const pages = this.context.pages();
    this.page =
      pages.length > 0 ? pages[pages.length - 1] : await this.context.newPage();

    await this.page.setViewportSize({
      width: this.viewport.width,
      height: this.viewport.height,
    });

    return { browser: this.browser, page: this.page };
  }

  /**
   * Returns the currently active page, recovering if the page was closed
   * (e.g., due to navigation opening a new tab/page).
   */
  public async getActivePage(): Promise<Page> {
    if (!this.browser || !this.browser.isConnected()) {
      throw new Error(
        "Browser not initialized or disconnected. Call launch() first.",
      );
    }

    if (!this.context) {
      throw new Error("Browser context not initialized. Call launch() first.");
    }

    const pages = this.context.pages();
    if (pages.length > 0) {
      // Use the last page (most recently opened tab)
      this.page = pages[pages.length - 1];
      return this.page;
    }

    // No pages at all — create a new one
    this.page = await this.context.newPage();
    return this.page;
  }

  public async close(): Promise<void> {
    // Reset incremental snapshot tracking for next session
    resetSnapshotTracking();

    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) {
        log.error(
          `Error closing browser: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      this.browser = null;
      this.context = null;
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

  public getContext(): BrowserContext {
    if (!this.context) {
      throw new Error("Browser not initialized. Call launch() first.");
    }
    return this.context;
  }
}

export const getBrowserManager = (viewport?: ViewportConfig) =>
  BrowserManager.getInstance(viewport);
