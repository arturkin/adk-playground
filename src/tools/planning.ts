import { FunctionTool } from "@google/adk";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { parseTestCase } from "../tests/parser.js";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

export function formatTestMarkdown(data: {
  title: string;
  url: string;
  viewport: string;
  tags: string[];
  priority: string;
  steps: Array<{ description: string; assertions?: string[] }>;
  expectedOutcome: string;
  assertions: string[];
}): string {
  let md = `# ${data.title}\n\n## Metadata\n\n`;
  md += `- **url**: ${data.url}\n`;
  md += `- **viewport**: ${data.viewport}\n`;
  md += `- **tags**: ${data.tags.join(", ")}\n`;
  md += `- **priority**: ${data.priority}\n`;
  md += `\n## Steps\n\n`;
  data.steps.forEach((step, i) => {
    md += `${i + 1}. ${step.description}\n`;
    if (step.assertions) {
      step.assertions.forEach((a) => {
        md += `   - [ ] ${a}\n`;
      });
    }
  });
  md += `\n## Expected Outcome\n\n${data.expectedOutcome}\n`;
  md += `\n## Assertions\n\n`;
  data.assertions.forEach((a) => {
    md += `- [ ] ${a}\n`;
  });
  return md;
}

// Module-level state for output directory (set before agent runs)
let outputDir = "./tests";

export function setOutputDir(dir: string): void {
  outputDir = dir;
}

export const saveTestPlanTool = new FunctionTool({
  name: "save_test_plan",
  description:
    "Save a generated test plan as a markdown file in the test directory. Call this for each test case you want to create.",
  parameters: z.object({
    title: z.string().describe("Test case title"),
    url: z.string().describe("Target URL for the test"),
    viewport: z
      .enum(["desktop", "mobile", "tablet"])
      .describe("Viewport to use")
      .default("desktop"),
    tags: z.array(z.string()).describe("Tags for categorization"),
    priority: z
      .enum(["low", "medium", "high", "critical"])
      .describe("Test priority")
      .default("medium"),
    steps: z
      .array(
        z.object({
          description: z.string().describe("Step instruction"),
          assertions: z
            .array(z.string())
            .optional()
            .describe("Assertions to check after this step"),
        }),
      )
      .describe("Numbered test steps"),
    expectedOutcome: z.string().describe("What should happen when test passes"),
    assertions: z.array(z.string()).describe("Final assertions to validate"),
  }),
  execute: async (params) => {
    const markdown = formatTestMarkdown(params);
    const filename = `${slugify(params.title)}.md`;
    const filePath = path.resolve(outputDir, filename);

    // Ensure output directory exists
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, markdown, "utf-8");

    // Validate the generated file is parseable
    try {
      const parsed = parseTestCase(filePath);
      return {
        status: "success",
        message: `Test saved: ${filePath}`,
        title: parsed.title,
        steps: parsed.steps.length,
        assertions: parsed.assertions.length,
      };
    } catch (e) {
      return {
        status: "error",
        message: `Test saved but validation failed: ${(e as Error).message}`,
        filePath,
      };
    }
  },
});
