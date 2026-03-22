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

// Default viewports
export const DEFAULT_VIEWPORTS = [
  { name: "desktop", width: 1280, height: 1000 },
  { name: "mobile", width: 375, height: 812 },
  { name: "mobile-pro", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
] as const;
