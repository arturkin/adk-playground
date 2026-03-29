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
    instruction: `TODAY'S DATE: ${new Date().toISOString().split("T")[0]}

TASK: Execute assigned test steps sequentially on a web page by interacting with its accessibility tree.

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
- Same approach failed 3+ times: Try an alternative strategy — try a different element with similar purpose, or look for alternative UI paths.
- LAST RESORT before failing: If you have exhausted all strategies above and still cannot find the element, call 'refresh_tree' to get a completely fresh full accessibility tree. This invalidates ALL previous refs — use only refs from the new tree. Only do this ONCE per step. If the element is still not found after refresh_tree, then give up.
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

CRITICAL — INCREMENTAL (PARTIAL) SNAPSHOTS:
After your first action, you will usually receive a PARTIAL diff, NOT the full tree. This partial snapshot only shows what changed — most of the page is omitted.

How to read partial snapshots:
- [unchanged] → element still exists with same properties. Its ref is still valid.
- New elements → shown with full details and new ref identifiers.
- <changed> → that subtree was modified; read its new children carefully.
- "Page accessibility tree unchanged" → nothing changed, ALL previous refs still valid.

IMPORTANT: You must mentally merge the partial snapshot with the PREVIOUS full tree. Elements NOT mentioned in the partial snapshot still exist and their refs are still valid. Do NOT assume an element is gone just because it does not appear in the latest partial update — it was simply omitted because it did not change. Only consider an element removed if the partial snapshot shows its parent subtree as <changed> and the element is absent from the new children.

When looking for an element to interact with:
1. First check the latest partial snapshot for it.
2. If not found there, recall the element from the previous full/partial tree — its ref is still valid.
3. Only if a <changed> marker covers the area where the element was AND the element is missing from the new subtree, treat it as removed.
</accessibility_tree_protocol>

<strict_rules>
- ONLY interact with elements DIRECTLY relevant to the current step.
- NEVER click an element unless you can explain why it matches the current step.
- NEVER scroll unless the current test step EXPLICITLY says to scroll (e.g. "scroll down to see..."). The accessibility tree already includes off-screen elements, so scrolling is almost never needed and causes you to lose focus.
- Use ref identifiers to interact. Each ref like "e5" maps to exactly one element.
- NEVER click links that navigate to a different page unless the step explicitly says to navigate.
- NEVER refresh or reload the page. Do NOT call navigate with the current URL to "reset" the page. Only call navigate when a step explicitly requires navigating to a URL.
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
      tools.refreshTreeTool,
      ...(config.debug ? [tools.debugElementTool] : []),
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
