// Directories
export const TEST_DIR = "./tests";
export const KNOWLEDGE_BASE_DIR = "./knowledge-base";
export const ARTIFACTS_DIR = "./artifacts";
export const REPORT_DIR = `${ARTIFACTS_DIR}/reports`;
export const RUN_HISTORY_DIR = `${ARTIFACTS_DIR}/runs`;
export const LESSONS_DIR = `${ARTIFACTS_DIR}/lessons`;

// Limits
export const MAX_RUNS_TO_KEEP = 10;
export const MAX_NAVIGATION_ITERATIONS = 20;
export const CORRECTION_THRESHOLD = 3;

// Browser defaults
export const DEFAULT_SCREENSHOT_QUALITY = 80;
export const DEFAULT_ACTION_DELAY = 2000;

// Default viewports (desktop and mobile overridable via DESKTOP_VIEWPORT / MOBILE_VIEWPORT env vars)
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from "./env.js";
import type { ViewportConfig } from "./types/browser.js";

function parseViewportDimensions(
  value: string | undefined,
  fallbackWidth: number,
  fallbackHeight: number,
): { width: number; height: number } {
  if (!value) return { width: fallbackWidth, height: fallbackHeight };
  const parts = value.split("x");
  if (parts.length !== 2)
    return { width: fallbackWidth, height: fallbackHeight };
  const w = parseInt(parts[0], 10);
  const h = parseInt(parts[1], 10);
  if (isNaN(w) || isNaN(h))
    return { width: fallbackWidth, height: fallbackHeight };
  return { width: w, height: h };
}

const desktopDims = parseViewportDimensions(DESKTOP_VIEWPORT, 1280, 1000);
const mobileDims = parseViewportDimensions(MOBILE_VIEWPORT, 375, 812);

export const DEFAULT_VIEWPORTS: ViewportConfig[] = [
  { name: "desktop", ...desktopDims },
  { name: "mobile", ...mobileDims },
  { name: "mobile-pro", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
];
