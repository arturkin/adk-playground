import { z } from "zod";

export const ViewportSchema = z.object({
  name: z.string(),
  width: z.number(),
  height: z.number(),
});

export const ConfigSchema = z.object({
  apiKey: z.string(),
  models: z.object({
    navigator: z.string().default("gemini-2.5-flash"),
    validator: z.string().default("gemini-2.5-flash"),
    reporter: z.string().default("gemini-2.5-flash"),
    evaluator: z.string().default("gemini-2.5-flash"),
  }),
  // Thinking token budgets per agent. 0 = disabled, -1 = auto, N = N tokens.
  // Only effective on models that support thinking (Gemini 2.5+, Gemini 3.x).
  thinkingBudgets: z.object({
    navigator: z.number().default(8000),  // High: complex multi-step navigation & planning
    validator: z.number().default(2000),  // Medium: structured assertion evaluation
    reporter: z.number().default(0),      // Off: simple text formatting & summarization
  }).default({}),
  headless: z.boolean().default(true),
  viewports: z.array(ViewportSchema).default([
    { name: "desktop", width: 1280, height: 1000 },
    { name: "mobile", width: 375, height: 812 }, // iPhone
    { name: "mobile-pro", width: 390, height: 844 }, // iPhone Pro
    { name: "tablet", width: 768, height: 1024 }, // iPad
  ]),
  maxNavigationIterations: z.number().default(20),
  screenshotQuality: z.number().default(80),
  actionDelay: z.number().default(2000),
  testDir: z.string().default("./tests"),
  knowledgeBaseDir: z.string().default("./knowledge-base"),
  reportDir: z.string().default("./reports"),
  runHistoryDir: z.string().default("./.qa-runs"),
  lessonsDir: z.string().default("./.qa-lessons"),
  debug: z.boolean().default(false),
  saveDebugScreenshots: z.boolean().default(false),
});

export type AppConfig = z.infer<typeof ConfigSchema>;
