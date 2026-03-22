import { z } from "zod";
import {
  DEFAULT_ACTION_DELAY,
  DEFAULT_SCREENSHOT_QUALITY,
  DEFAULT_VIEWPORTS,
  MAX_NAVIGATION_ITERATIONS,
} from "../constants.js";

export const ViewportSchema = z.object({
  name: z.string(),
  width: z.number(),
  height: z.number(),
});

export const ConfigSchema = z.object({
  apiKey: z.string(),
  models: z.object({
    navigator: z.string().default("gemini-3-flash-preview"),
    validator: z.string().default("gemini-3-flash-preview"),
    reporter: z.string().default("gemini-3-flash-preview"),
    evaluator: z.string().default("gemini-3-flash-preview"),
  }),
  // Thinking token budgets per agent. 0 = disabled, -1 = auto, N = N tokens.
  // Only effective on models that support thinking (Gemini 2.5+, Gemini 3.x).
  thinkingBudgets: z
    .object({
      navigator: z.number().default(8000), // High: complex multi-step navigation & planning
      validator: z.number().default(2000), // Medium: structured assertion evaluation
      reporter: z.number().default(0), // Off: simple text formatting & summarization
      evaluator: z.number().default(1000), // Low: text reasoning over assertion evidence
    })
    .default({
      navigator: 8000,
      validator: 2000,
      reporter: 0,
      evaluator: 1000,
    }),
  cdpEndpoint: z.string().optional(),
  headless: z.boolean().default(true),
  viewports: z.array(ViewportSchema).default([...DEFAULT_VIEWPORTS]),
  maxNavigationIterations: z.number().default(MAX_NAVIGATION_ITERATIONS),
  screenshotQuality: z.number().default(DEFAULT_SCREENSHOT_QUALITY),
  actionDelay: z.number().default(DEFAULT_ACTION_DELAY),
  debug: z.boolean().default(false),
  saveDebugScreenshots: z.boolean().default(false),
});

export type AppConfig = z.infer<typeof ConfigSchema>;
