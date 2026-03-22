function str(key: string): string | undefined {
  return process.env[key] || undefined;
}

function int(key: string): number | undefined {
  const val = process.env[key];
  return val !== undefined ? parseInt(val) : undefined;
}

function bool(key: string): boolean {
  return process.env[key] === "true";
}

// API
export const GOOGLE_GENAI_API_KEY = str("GOOGLE_GENAI_API_KEY") ?? "";

// Models (aliases resolved in config)
export const NAVIGATOR_MODEL = str("NAVIGATOR_MODEL") ?? "flash3";
export const VALIDATOR_MODEL = str("VALIDATOR_MODEL") ?? "flash3";
export const REPORTER_MODEL = str("REPORTER_MODEL") ?? "flash3";
export const EVALUATOR_MODEL = str("EVALUATOR_MODEL") ?? "flash3";

// Thinking budgets
export const NAVIGATOR_THINKING_BUDGET = int("NAVIGATOR_THINKING_BUDGET");
export const VALIDATOR_THINKING_BUDGET = int("VALIDATOR_THINKING_BUDGET");
export const REPORTER_THINKING_BUDGET = int("REPORTER_THINKING_BUDGET");
export const EVALUATOR_THINKING_BUDGET = int("EVALUATOR_THINKING_BUDGET");

// Runtime flags
export const HEADLESS = str("HEADLESS") !== "false";
export const CI = bool("CI");
export const DEBUG = bool("DEBUG");
export const MAX_ITERATIONS = int("MAX_ITERATIONS");
