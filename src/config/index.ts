import { ConfigSchema, type AppConfig } from "./schema.js";
import { getModelName } from "./models.js";
import * as env from "../env.js";

function loadConfig(): AppConfig {
  const config = {
    apiKey: env.GOOGLE_GENAI_API_KEY,
    models: {
      navigator: getModelName(env.NAVIGATOR_MODEL),
      validator: getModelName(env.VALIDATOR_MODEL),
      reporter: getModelName(env.REPORTER_MODEL),
      evaluator: getModelName(env.EVALUATOR_MODEL),
    },
    thinkingBudgets: {
      navigator: env.NAVIGATOR_THINKING_BUDGET,
      validator: env.VALIDATOR_THINKING_BUDGET,
      reporter: env.REPORTER_THINKING_BUDGET,
      evaluator: env.EVALUATOR_THINKING_BUDGET,
    },
    headless: env.HEADLESS,
    maxNavigationIterations: env.MAX_ITERATIONS,
    debug: env.DEBUG,
  };

  // Remove undefined values to let Zod defaults kick in
  const cleanConfig = Object.fromEntries(
    Object.entries(config).filter(([, v]) => v !== undefined),
  );

  const result = ConfigSchema.safeParse(cleanConfig);

  if (!result.success) {
    console.error("❌ Invalid configuration:", result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();
export * from "./schema.js";
export * from "./models.js";
