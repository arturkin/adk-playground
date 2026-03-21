import { getBrowserManager } from "./manager.js";
import * as actions from "./page-actions.js";
import * as accessibility from "./accessibility.js";

// Re-export core modules
export * from "./manager.js";
export * from "./page-actions.js";
export * from "./accessibility.js";

/**
 * CONVENIENCE LAYER
 * These functions wrap the BrowserManager and pure functions
 * so callers don't need to manage the Page reference themselves.
 */

export async function launchBrowser() {
  const manager = getBrowserManager();
  const isCI = process.env.CI === "true";
  const isHeadless = isCI || process.env.HEADLESS === "true";
  return await manager.launch(isHeadless);
}

export async function closeBrowser() {
  await getBrowserManager().close();
}

export async function navigateTo(url: string) {
  const page = await getBrowserManager().getActivePage();
  return await actions.navigateTo(page, url);
}

export async function scrollPage(direction: "up" | "down" | "bottom" | "top") {
  const page = await getBrowserManager().getActivePage();
  return await actions.scrollPage(page, direction);
}

export async function clickAt(x: number, y: number) {
  const page = await getBrowserManager().getActivePage();
  return await actions.clickAt(page, x, y);
}

export async function hoverElement(ref: string) {
  const page = await getBrowserManager().getActivePage();
  return await actions.hoverElement(page, ref);
}

export async function clickElement(ref: string) {
  const page = await getBrowserManager().getActivePage();
  return await actions.clickElement(page, ref);
}

export async function typeElement(ref: string, text: string) {
  const page = await getBrowserManager().getActivePage();
  return await actions.typeElement(page, ref, text);
}

export async function getScreenshot() {
  const page = await getBrowserManager().getActivePage();
  return await actions.getScreenshot(page);
}

export async function typeText(text: string) {
  const page = await getBrowserManager().getActivePage();
  return await actions.typeText(page, text);
}

export async function pressKey(key: string) {
  const page = await getBrowserManager().getActivePage();
  return await actions.pressKey(page, key);
}

export async function captureAccessibilitySnapshot() {
  const page = await getBrowserManager().getActivePage();
  return await accessibility.captureAccessibilitySnapshot(page);
}

export async function resolveRef(ref: string) {
  const page = await getBrowserManager().getActivePage();
  return accessibility.resolveRef(page, ref);
}

export async function forceSingleTab() {
  const page = await getBrowserManager().getActivePage();
  return await accessibility.forceSingleTab(page);
}
