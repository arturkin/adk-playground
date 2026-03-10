import { ConfigSchema, type AppConfig } from "./schema.js";
import { getModelName } from "./models.js";

function loadConfig(): AppConfig {
  const config = {
    apiKey: process.env.GOOGLE_GENAI_API_KEY || "",
    models: {
      navigator: getModelName(process.env.NAVIGATOR_MODEL || "flash25"),
      validator: getModelName(process.env.VALIDATOR_MODEL || "flash25"),
      reporter: getModelName(process.env.REPORTER_MODEL || "flash25"),
      evaluator: getModelName(process.env.EVALUATOR_MODEL || "flash25"),
    },
    thinkingBudgets: {
      navigator: process.env.NAVIGATOR_THINKING_BUDGET !== undefined
        ? parseInt(process.env.NAVIGATOR_THINKING_BUDGET) : undefined,
      validator: process.env.VALIDATOR_THINKING_BUDGET !== undefined
        ? parseInt(process.env.VALIDATOR_THINKING_BUDGET) : undefined,
      reporter: process.env.REPORTER_THINKING_BUDGET !== undefined
        ? parseInt(process.env.REPORTER_THINKING_BUDGET) : undefined,
      evaluator: process.env.EVALUATOR_THINKING_BUDGET !== undefined
        ? parseInt(process.env.EVALUATOR_THINKING_BUDGET) : undefined,
    },
    headless: process.env.HEADLESS !== "false",
    maxNavigationIterations: process.env.MAX_ITERATIONS
      ? parseInt(process.env.MAX_ITERATIONS)
      : undefined,
    testDir: process.env.TEST_DIR,
    knowledgeBaseDir: process.env.KNOWLEDGE_BASE_DIR,
    reportDir: process.env.REPORT_DIR,
    lessonsDir: process.env.LESSONS_DIR,
    debug: process.env.DEBUG === "true",
  };

  // Remove undefined values to let Zod defaults kick in
  const cleanConfig = Object.fromEntries(
    Object.entries(config).filter(([_, v]) => v !== undefined),
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
