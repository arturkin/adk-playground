import { Page, Frame } from "puppeteer";

/**
 * Executes an evaluate function with retries if it fails due to navigation or frame detachment.
 */
export async function robustEvaluate<T>(pageOrFrame: Page | Frame, fn: (...args: any[]) => T | Promise<T>, ...args: any[]): Promise<T> {
  let retries = 5;
  let delay = 2000;
  
  while (retries > 0) {
    try {
      // If it's a Page, we want the current main frame.
      // Sometimes page.mainFrame() returns a detached frame if navigation is in progress.
      // Trying page.frames()[0] as an alternative.
      let target: Page | Frame = pageOrFrame;
      if ((pageOrFrame as any).mainFrame) {
          const frames = (pageOrFrame as Page).frames();
          target = frames[0] || (pageOrFrame as Page).mainFrame();
      }
      
      return await target.evaluate(fn, ...args);
    } catch (e) {
      const msg = (e as Error).message;
      const isDetached = msg.includes("detached Frame") || 
                        msg.includes("Execution context was destroyed") || 
                        msg.includes("Target closed") ||
                        msg.includes("Protocol error") ||
                        msg.includes("context was destroyed") ||
                        msg.includes("ReferenceError: aiElementMap is not defined");
      
      if (isDetached) {
        retries--;
        if (retries === 0) throw e;
        
        console.warn(`    \x1b[33m[robustEvaluate]\x1b[0m Retrying due to: ${msg.substring(0, 100)}... (${retries} retries left)`);
        
        if ((pageOrFrame as any).mainFrame) {
            const page = pageOrFrame as Page;
            const frames = page.frames();
            console.warn(`    \x1b[33m[robustEvaluate]\x1b[0m Current frames: ${frames.length}, URLs: ${frames.map(f => f.url().substring(0, 30)).join(', ')}`);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5;
        
        if ((pageOrFrame as any).mainFrame) {
            const page = pageOrFrame as Page;
            try {
                // If we are stuck with detached frame, maybe a small navigation or reload helps?
                // But let's try waiting for network idle instead.
                await page.waitForNetworkIdle({ timeout: 2000 }).catch(() => {});
            } catch {}
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
export async function robustScreenshot(page: Page, quality: number = 80): Promise<string> {
  let retries = 5;
  let delay = 1000;
  while (retries > 0) {
    try {
      const buffer = await page.screenshot({
        type: "jpeg",
        quality: quality,
        encoding: "base64",
      });
      return buffer as string;
    } catch (e) {
      const msg = (e as Error).message;
      const isRecoverable = msg.includes("Target closed") ||
                           msg.includes("detached Frame") ||
                           msg.includes("context was destroyed") ||
                           msg.includes("Protocol error");

      if (isRecoverable) {
        retries--;
        if (retries === 0) throw e;
        console.warn(`    \x1b[33m[robustScreenshot]\x1b[0m Retrying due to: ${msg.substring(0, 100)}... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5;
      } else {
        throw e;
      }
    }
  }
  throw new Error("Failed to take screenshot after retries");
}
