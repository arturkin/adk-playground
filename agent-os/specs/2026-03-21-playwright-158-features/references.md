# References for Playwright 1.58 Feature Adoption

## Files to Modify

### Incremental Snapshots

- `src/browser/accessibility.ts` — Core snapshot capture, PageWithSnapshot interface
- `src/browser/index.ts` — Convenience wrapper for captureAccessibilitySnapshot
- `src/tools/helpers.ts` — captureBrowserState() wiring
- `src/agents/callbacks.ts` — injectScreenshotCallback labeling
- `src/agents/navigator.ts` — Navigator prompt update
- `src/browser/manager.ts` — Reset tracking in close()
- `src/tests/runner.ts` — Reset tracking between test cases

### Test Generator

- `src/agents/planner.ts` (new) — Planner LlmAgent
- `src/tools/planning.ts` (new) — save_test_plan FunctionTool
- `src/tools/index.ts` — Export planning tools
- `src/agents/index.ts` — Export planner agent
- `src/index.ts` — generate CLI command

### CDP Connection

- `src/config/schema.ts` — cdpEndpoint config field
- `src/browser/manager.ts` — connectCDP() method
- `src/browser/index.ts` — connectCDP convenience wrapper
- `src/index.ts` — --cdp CLI option

## External References

### Playwright Incremental Snapshot API

- **Location:** `node_modules/playwright/lib/mcp/browser/tab.js` (line ~203)
- **Relevance:** Shows `_snapshotForAI({ track: "response" })` usage with `.full` and `.incremental` properties

### Playwright Planner Agent

- **Location:** `node_modules/playwright/lib/agents/playwright-test-planner.agent.md`
- **Relevance:** Prompt structure for exploring URLs and generating test plans

### Existing Test Format

- **Location:** `tests/flight-search.md`
- **Relevance:** Target format for generated test files
- **Parser:** `src/tests/parser.ts`
