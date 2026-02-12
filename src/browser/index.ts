import { getBrowserManager } from "./manager.js";
import * as actions from "./page-actions.js";
import * as tagger from "./visual-tagger.js";

// Re-export core modules
export * from "./manager.js";
export * from "./page-actions.js";
export * from "./visual-tagger.js";

/**
 * BACKWARD COMPATIBILITY LAYER
 * These functions wrap the new class-based BrowserManager and pure functions
 * to ensure existing code doesn't break during migration.
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
  const page = getBrowserManager().getPage();
  return await actions.navigateTo(page, url);
}

export async function scrollPage(direction: "up" | "down" | "bottom" | "top") {
  const page = getBrowserManager().getPage();
  return await actions.scrollPage(page, direction);
}

export async function clickAt(x: number, y: number) {
  const page = getBrowserManager().getPage();
  return await actions.clickAt(page, x, y);
}

export async function tagElements(renderIndex: number = 0) {
  const page = getBrowserManager().getPage();
  return await tagger.tagElements(page, renderIndex);
}

export async function clickElement(id: number) {
  const page = getBrowserManager().getPage();
  return await actions.clickElement(page, id);
}

export async function typeElement(id: number, text: string) {
  const page = getBrowserManager().getPage();
  return await actions.typeElement(page, id, text);
}

export async function getScreenshot() {
  const page = getBrowserManager().getPage();
  return await actions.getScreenshot(page);
}

export async function typeText(text: string) {
  const page = getBrowserManager().getPage();
  return await actions.typeText(page, text);
}

export async function pressKey(key: string) {
  const page = getBrowserManager().getPage();
  return await actions.pressKey(page, key);
}
