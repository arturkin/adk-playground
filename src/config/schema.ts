import { z } from 'zod';

export const ViewportSchema = z.object({
  name: z.string(),
  width: z.number(),
  height: z.number(),
});

export const ConfigSchema = z.object({
  apiKey: z.string(),
  models: z.object({
    navigator: z.string().default('gemini-3-flash-preview'),
    validator: z.string().default('gemini-3-flash-preview'),
    reporter: z.string().default('gemini-3-flash-preview'),
    evaluator: z.string().default('gemini-3-flash-preview'),
  }),
  headless: z.boolean().default(true),
  viewports: z.array(ViewportSchema).default([
    { name: 'desktop', width: 1280, height: 1000 },
    { name: 'mobile', width: 375, height: 812 }, // iPhone
    { name: 'mobile-pro', width: 390, height: 844 }, // iPhone Pro
    { name: 'tablet', width: 768, height: 1024 }, // iPad
  ]),
  maxNavigationIterations: z.number().default(20),
  screenshotQuality: z.number().default(80),
  actionDelay: z.number().default(2000),
  testDir: z.string().default('./tests'),
  reportDir: z.string().default('./reports'),
  runHistoryDir: z.string().default('./.qa-runs'),
  debug: z.boolean().default(false),
  saveDebugScreenshots: z.boolean().default(false),
});

export type AppConfig = z.infer<typeof ConfigSchema>;
