import { LlmAgent } from "@google/adk";
import type { AppConfig } from "../config/schema.js";
import * as tools from "../tools/index.js";
import { saveTestPlanTool } from "../tools/planning.js";
import {
  injectScreenshotCallback,
  emptyResponseNudgeCallback,
} from "./callbacks.js";

export function buildPlannerAgent(config: AppConfig, maxTests: number = 5) {
  return new LlmAgent({
    name: "planner",
    model: config.models.navigator,
    instruction: `You are a QA test planner. Your goal is to explore a web application and generate comprehensive test cases.

TARGET URL: {url_hint}
MAXIMUM TESTS: ${maxTests}

YOUR PROCESS:
1. Navigate to the target URL
2. Explore the page using the accessibility tree — identify all interactive elements, forms, navigation paths, and features
3. Click through key sections to understand the application's functionality
4. Design test scenarios covering:
   - Happy path (normal user behavior)
   - Edge cases and boundary conditions
   - Error handling and validation
5. For each scenario, call save_test_plan with detailed steps

HOW TO READ THE ACCESSIBILITY TREE:
You receive a YAML accessibility tree of the page. Each element has a role, name, and ref identifier.
Example:
  - heading "Flight Search" [level=1] [ref=e3]
  - textbox "From" [ref=e7] value=""
  - button "Search" [ref=e12]

Use refs to interact: click_element(ref="e12"), type_element(ref="e7", text="...")

COOKIE/POPUP BANNERS:
If you see cookie consent or popup overlays, dismiss them first.

TEST QUALITY STANDARDS:
- Each test should be independent and runnable in isolation
- Steps must be specific enough for an automated agent to follow
- Include assertions for EACH step where visible validation is possible
- Final assertions should cover the expected end state
- Use "desktop" viewport unless the feature is mobile-specific
- Tags should categorize the feature area (e.g., "search", "navigation", "forms", "checkout")

STEP WRITING GUIDELINES:
- Write steps in plain language describing what to do
- Include specific text values for form fields
- Mention what to wait for when relevant (popups, loading states)
- Keep steps atomic — one action per step

When you have explored enough and generated ${maxTests} test(s), call task_completed to finish.`,
    tools: [
      tools.navigateTool,
      tools.scrollTool,
      tools.clickElementTool,
      tools.hoverElementTool,
      tools.typeElementTool,
      tools.pressKeyTool,
      tools.taskCompletedTool,
      saveTestPlanTool,
    ],
    outputKey: "planner_result",
    generateContentConfig: {
      thinkingConfig: { thinkingBudget: config.thinkingBudgets.navigator },
    },
    beforeModelCallback: injectScreenshotCallback,
    afterModelCallback: emptyResponseNudgeCallback,
  });
}
