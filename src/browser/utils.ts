import type { Page, Frame } from "playwright";
import { BrowserManager } from "./manager.js";
import { log } from "../logger/index.js";

function isRecoverableError(msg: string): boolean {
  return (
    msg.includes("Target page, context or browser has been closed") ||
    msg.includes("frame was detached") ||
    msg.includes("Execution context was destroyed") ||
    msg.includes("navigation interrupted") ||
    msg.includes("Target closed") ||
    msg.includes("Protocol error")
  );
}

/**
 * Executes an evaluate function with retries if it fails due to navigation or frame detachment.
 * When a detached frame is detected, it attempts to get a fresh page reference from the BrowserManager.
 */
export async function robustEvaluate<T>(
  pageOrFrame: Page | Frame,
  fn: (...fnArgs: unknown[]) => T | Promise<T>,
  ...args: unknown[]
): Promise<T> {
  let retries = 5;
  let delay = 2000;
  let currentTarget: Page | Frame = pageOrFrame;

  while (retries > 0) {
    try {
      return await currentTarget.evaluate(fn, ...args);
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      const msg = error.message;

      if (isRecoverableError(msg)) {
        retries--;
        if (retries === 0) throw e;

        log.warn(
          `[robustEvaluate] Retrying due to: ${msg.substring(0, 100)}... (${retries} retries left)`,
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 1.5;

        // Try to get a fresh page reference from the BrowserManager
        try {
          const freshPage = await BrowserManager.getInstance().getActivePage();
          currentTarget = freshPage;
          log.warn(`[robustEvaluate] Got fresh page, URL: ${freshPage.url()}`);
          // Wait for the page to be ready
          await freshPage
            .locator("body")
            .waitFor({ timeout: 5000 })
            .catch(() => {});
        } catch (refreshErr) {
          const refreshError =
            refreshErr instanceof Error
              ? refreshErr
              : new Error(String(refreshErr));
          log.warn(
            `[robustEvaluate] Could not refresh page: ${refreshError.message}`,
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
      });
      return buffer.toString("base64");
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      const msg = error.message;

      if (isRecoverableError(msg)) {
        retries--;
        if (retries === 0) throw e;
        log.warn(
          `[robustScreenshot] Retrying due to: ${msg.substring(0, 100)}... (${retries} retries left)`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 1.5;
        // Try to get a fresh page reference
        try {
          currentPage = await BrowserManager.getInstance().getActivePage();
        } catch {
          // ignore refresh failures, will retry with current page
        }
      } else {
        throw e;
      }
    }
  }
  throw new Error("Failed to take screenshot after retries");
}
