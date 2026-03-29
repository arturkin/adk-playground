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
    instruction: `TODAY'S DATE: ${new Date().toISOString().split("T")[0]}

TASK: Explore a web application and generate comprehensive test cases.

TARGET URL: {url_hint}
MAXIMUM TESTS: ${maxTests}

<process>
1. Navigate to the target URL.
2. If a cookie consent banner or popup overlay is present → dismiss it BEFORE any other action.
3. Explore the page using the accessibility tree — identify all interactive elements, forms, navigation paths, and features.
4. Click through key sections to understand the application's functionality.
5. Design test scenarios covering: happy path, edge cases, error handling/validation.
6. For each scenario → call save_test_plan with detailed steps.
7. When ${maxTests} test(s) are generated → call task_completed.
</process>

<conditional_logic>
- If cookie/popup overlay detected → dismiss first, then continue.
- If an element's purpose is ambiguous → infer from surrounding headings, labels, grouping.
- If a section requires authentication or is gated → skip, note in test plan tags.
</conditional_logic>

<error_handling>
- Target URL unreachable or error page → call task_completed with error description. Do NOT generate test plans.
- Page is blank (no accessible elements) → call task_completed with "empty page" explanation.
- Element interaction fails after 3 attempts → skip that element, proceed to next feature area.
- Accessibility tree not received → retry navigate once, then abort via task_completed.
</error_handling>

<accessibility_tree_protocol>
You receive a YAML accessibility tree of the page. Each element has a role, name, and ref identifier.
Example:
  - heading "Flight Search" [level=1] [ref=e3]
  - textbox "From" [ref=e7] value=""
  - button "Search" [ref=e12]

Use refs to interact: click_element(ref="e12"), type_element(ref="e7", text="...")
</accessibility_tree_protocol>

<output_contract>
Each save_test_plan call MUST produce a test that satisfies ALL of:
- Independent: runnable in isolation, no dependency on other tests.
- Specific: steps precise enough for an automated agent to follow without interpretation.
- Asserted: assertions for EACH step where visible validation is possible; final assertions for end state.
- Tagged: feature area tags (e.g., "search", "navigation", "forms", "checkout").
- Viewport: "desktop" unless feature is mobile-specific.

Step format requirements:
- Plain language (no code, no selectors).
- Specific text values for form fields.
- Wait conditions where relevant (popups, loading states).
- Atomic: one action per step.
</output_contract>`,
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
