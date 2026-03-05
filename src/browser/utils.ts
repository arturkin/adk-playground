import { Page, Frame } from "puppeteer";
import { BrowserManager } from "./manager.js";

/**
 * Executes an evaluate function with retries if it fails due to navigation or frame detachment.
 * When a detached frame is detected, it attempts to get a fresh page reference from the BrowserManager.
 */
export async function robustEvaluate<T>(
  pageOrFrame: Page | Frame,
  fn: (...args: any[]) => T | Promise<T>,
  ...args: any[]
): Promise<T> {
  let retries = 5;
  let delay = 2000;
  let currentTarget: Page | Frame = pageOrFrame;

  while (retries > 0) {
    try {
      return await currentTarget.evaluate(fn, ...args);
    } catch (e) {
      const msg = (e as Error).message;
      const isDetached =
        msg.includes("detached Frame") ||
        msg.includes("Execution context was destroyed") ||
        msg.includes("Target closed") ||
        msg.includes("Protocol error") ||
        msg.includes("context was destroyed") ||
        msg.includes("ReferenceError: aiElementMap is not defined");

      if (isDetached) {
        retries--;
        if (retries === 0) throw e;

        console.warn(
          `    \x1b[33m[robustEvaluate]\x1b[0m Retrying due to: ${msg.substring(0, 100)}... (${retries} retries left)`,
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 1.5;

        // Try to get a fresh page reference from the BrowserManager
        try {
          const freshPage = await BrowserManager.getInstance().getActivePage();
          currentTarget = freshPage;
          console.warn(
            `    \x1b[33m[robustEvaluate]\x1b[0m Got fresh page, URL: ${freshPage.url()}`,
          );
          // Wait for the page to be ready
          await freshPage
            .waitForSelector("body", { timeout: 5000 })
            .catch(() => {});
        } catch (refreshErr) {
          console.warn(
            `    \x1b[33m[robustEvaluate]\x1b[0m Could not refresh page: ${(refreshErr as Error).message}`,
          );
        }
      } else {
        throw e;
      }
    }
  }
  throw new Error("Failed after retries");
}

/**
 * Takes a screenshot with retries if it fails due to navigation or target closure.
 */
export async function robustScreenshot(
  page: Page,
  quality: number = 80,
): Promise<string> {
  let retries = 5;
  let delay = 1000;
  let currentPage = page;
  while (retries > 0) {
    try {
      const buffer = await currentPage.screenshot({
        type: "jpeg",
        quality: quality,
        encoding: "base64",
      });
      return buffer as string;
    } catch (e) {
      const msg = (e as Error).message;
      const isRecoverable =
        msg.includes("Target closed") ||
        msg.includes("detached Frame") ||
        msg.includes("context was destroyed") ||
        msg.includes("Protocol error");

      if (isRecoverable) {
        retries--;
        if (retries === 0) throw e;
        console.warn(
          `    \x1b[33m[robustScreenshot]\x1b[0m Retrying due to: ${msg.substring(0, 100)}... (${retries} retries left)`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 1.5;
        // Try to get a fresh page reference
        try {
          currentPage = await BrowserManager.getInstance().getActivePage();
        } catch {}
      } else {
        throw e;
      }
    }
  }
  throw new Error("Failed to take screenshot after retries");
}
