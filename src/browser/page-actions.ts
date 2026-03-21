import { Page } from "playwright";
import { resolveRef } from "./accessibility.js";

export async function navigateTo(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

export async function scrollPage(
  page: Page,
  direction: "up" | "down" | "bottom" | "top",
) {
  const scrollBefore = await page.evaluate(() => ({
    x: window.scrollX,
    y: window.scrollY,
    pageH: document.body.scrollHeight,
  }));
  console.log(
    `    \x1b[35m[scroll ${direction}]\x1b[0m Before: scrollY=${scrollBefore.y}, pageHeight=${scrollBefore.pageH}`,
  );

  await page.evaluate((dir) => {
    if (dir === "down") window.scrollBy(0, window.innerHeight);
    else if (dir === "up") window.scrollBy(0, -window.innerHeight);
    else if (dir === "bottom")
      window.scrollTo(0, document.body.scrollHeight);
    else if (dir === "top") window.scrollTo(0, 0);
  }, direction);

  const scrollAfter = await page.evaluate(() => window.scrollY);
  console.log(
    `    \x1b[35m[scroll ${direction}]\x1b[0m After: scrollY=${scrollAfter}`,
  );
}

export async function clickAt(page: Page, x: number, y: number) {
  await page.mouse.click(x, y);
}

export async function hoverElement(page: Page, ref: string) {
  const locator = resolveRef(page, ref);
  await locator.hover({ timeout: 5000 });
  console.log(`    \x1b[35m[hover_element ${ref}]\x1b[0m Hovered`);
}

export async function clickElement(page: Page, ref: string) {
  const locator = resolveRef(page, ref);

  // Log element info before clicking
  const tagName = await locator.evaluate((el) => el.tagName.toLowerCase());
  const text = await locator
    .evaluate((el) => (el.textContent || "").trim().slice(0, 80))
    .catch(() => "");
  console.log(
    `    \x1b[35m[click_element ${ref}]\x1b[0m tag=${tagName} text="${text}"`,
  );

  // Playwright's click auto-scrolls, auto-waits for actionability,
  // and handles navigation detection
  await locator.click({ timeout: 10000 });

  // Wait briefly for any navigation or rendering triggered by the click
  await page
    .waitForLoadState("domcontentloaded", { timeout: 2000 })
    .catch(() => {});

  const currentUrl = page.url();
  console.log(
    `    \x1b[35m[click_element ${ref}]\x1b[0m Current URL: ${currentUrl}`,
  );
}

export async function typeElement(page: Page, ref: string, text: string) {
  const locator = resolveRef(page, ref);
  // Click to focus the element first
  await locator.click({ timeout: 5000 });
  // Clear existing content
  await locator.fill("", { timeout: 5000 });
  // Type character by character to trigger autocomplete/search handlers
  // that rely on keydown/keyup/input events from real keystrokes
  await locator.pressSequentially(text, { delay: 50 });
  // Wait for any debounced search/autocomplete to fire
  await new Promise((resolve) => setTimeout(resolve, 500));
}

export async function getScreenshot(page: Page, quality: number = 80) {
  const buffer = await page.screenshot({
    type: "jpeg",
    quality: quality,
  });
  return buffer.toString("base64");
}

export async function typeText(page: Page, text: string) {
  await page.keyboard.type(text);
}

export async function pressKey(page: Page, key: string) {
  // Keys that can trigger form submission / navigation
  const navigationKeys = ["Enter", "NumpadEnter"];
  const mightNavigate = navigationKeys.includes(key);

  await page.keyboard.press(key);

  if (mightNavigate) {
    // Wait briefly to see if navigation occurred
    await page
      .waitForLoadState("domcontentloaded", { timeout: 3000 })
      .catch(() => {});
  }
}
