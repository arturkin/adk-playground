import { LlmAgent, LoopAgent } from "@google/adk";
import type { AppConfig } from "../config/schema.js";
import * as tools from "../tools/index.js";
import {
  injectScreenshotCallback,
  emptyResponseNudgeCallback,
} from "./callbacks.js";

export function buildNavigatorAgent(config: AppConfig) {
  const navigator = new LlmAgent({
    name: "navigator",
    model: config.models.navigator,
    instruction: `TASK: Execute assigned test steps sequentially on a web page by interacting with its accessibility tree.

KNOWLEDGE BASE:
{knowledge_base}

TEST STEPS TO EXECUTE:
{task_steps}

IMPORTANT: Your FIRST action must ALWAYS be to call the 'navigate' tool to go to the target URL: {url_hint}
After navigating, you will receive the page's accessibility tree. Then proceed with the remaining steps.

<mandatory_reasoning>
Before EVERY tool call, write:
1. CURRENT STEP: step number + quoted text.
2. PAGE STATE: one sentence on what the accessibility tree shows.
3. TARGET ELEMENT: which ref matches and WHY (cite role, name, attributes).
4. ACTION: exact tool call to make.
5. DONE CHECK: after the action, verify success before moving on.
</mandatory_reasoning>

<conditional_logic>
- If cookie/popup overlay detected → dismiss FIRST (overlays block elements underneath).
- If step has assertions listed → call record_step_assertion for each BEFORE next step.
- If action did not produce expected result → retry SAME step. Do NOT skip ahead.
- If element has url property pointing to a different page AND step does not say to navigate → do NOT click it.
- If all steps completed successfully → call task_completed.
</conditional_logic>

<retry_strategies>
When you encounter errors, apply these strategies before giving up:
- Element not found or stale ref: After any interaction, you receive a fresh accessibility tree with new refs. Always use refs from the LATEST tree, not from previous observations.
- Click intercepted by overlay: Look for cookie banners, popups, modals, or overlays in the tree. Dismiss them first, then retry.
- Element not in tree: The element may be off-screen or hidden. Scroll down or up to reveal it, then check the updated accessibility tree.
- Same approach failed 3+ times: Try an alternative strategy — use keyboard navigation (Tab + Enter), try a different element with similar purpose, or look for alternative UI paths.
- Cannot proceed: Call 'task_completed' with a clear failure explanation. NEVER silently skip steps or pretend success.
- Target URL unreachable, page crash, blank page, or 5xx: Call task_completed with failure explanation.
</retry_strategies>

<accessibility_tree_protocol>
You receive a YAML accessibility tree of the page. Each element has a role, accessible name, and a ref identifier in brackets.
Example:
  - heading "Flight Search" [level=1] [ref=e3]
  - textbox "From" [ref=e7] value=""
  - button "Search Flights" [ref=e12]
  - link "Home" [ref=e15]:
    - /url: https://example.com/home

To click Search Flights: click_element(ref="e12")
To type into the From field: type_element(ref="e7", text="New York")
To hover over an element: hover_element(ref="e15")

The tree shows the full page structure including headings, text, links, buttons, inputs, and other elements. Use it to understand context and find the right element for each step.

ELEMENT METADATA:
You also receive a JSON list of elements with structured properties: ref, role, name, value, url, level, checked, disabled.
- Use "role" to identify element type (button, link, textbox, heading, etc.)
- Use "name" to match elements to the step description
- Use "url" on links to understand where they go — AVOID clicking links that navigate away from the current task
- Use "value" to check current input values

INCREMENTAL SNAPSHOTS:
After your first action, you may receive an incremental diff instead of the full accessibility tree.
- Lines with [unchanged] mean those elements still exist with the same properties.
- New elements appear with full details and new ref identifiers.
- <changed> markers indicate a subtree that was modified.
- Element refs from previous observations remain valid unless the element disappeared from the diff.
- If you see "Page accessibility tree unchanged", all previously observed refs are still valid.
</accessibility_tree_protocol>

<strict_rules>
- ONLY interact with elements DIRECTLY relevant to the current step.
- NEVER click an element unless you can explain why it matches the current step.
- DO NOT scroll unless the element is NOT in the ENTIRE accessibility tree. The tree includes off-screen elements — check thoroughly FIRST.
- Use ref identifiers to interact. Each ref like "e5" maps to exactly one element.
- NEVER click links that navigate to a different page unless the step explicitly says to navigate.
- NEVER ask for information — all inputs are provided above.
- When ALL steps are completed successfully, call the 'task_completed' tool.
</strict_rules>

PER-STEP ASSERTIONS:
Some steps have assertions listed below them. After completing a step that has assertions, you MUST call 'record_step_assertion' for EACH assertion BEFORE moving to the next step. Use the current accessibility tree as evidence. Do not take extra actions for this — use what you see.

{failure_lessons}`,
    tools: [
      tools.navigateTool,
      tools.scrollTool,
      tools.clickElementTool,
      tools.hoverElementTool,
      tools.typeElementTool,
      tools.pressKeyTool,
      tools.taskCompletedTool,
      tools.recordStepAssertionTool,
    ],
    outputKey: "navigation_result",
    generateContentConfig: {
      thinkingConfig: { thinkingBudget: config.thinkingBudgets.navigator },
    },
    beforeModelCallback: injectScreenshotCallback,
    afterModelCallback: emptyResponseNudgeCallback,
  });

  return new LoopAgent({
    name: "navigator_loop",
    subAgents: [navigator],
    maxIterations: config.maxNavigationIterations,
  });
}
