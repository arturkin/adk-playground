# Refactor ADK-Playground to Meet MVP

## Context

The project is a working prototype (named "junie-automatic-qa") that can navigate web pages and execute QA tasks using a single Genkit agent loop with Puppeteer + visual element tagging (Set-of-Mark). However, it's far from the MVP defined in the product roadmap. This plan refactors the project incrementally to:

1. **Migrate from Genkit to Google ADK** (`@google/adk`) for proper multi-agent orchestration
2. **Restructure the codebase** with clean separation of concerns
3. **Implement all MVP features**: markdown test definitions, multi-agent architecture, run memory/regression detection, bug reporting, versatile testing (mobile/desktop/SEO), configurable LLM usage
4. **Lay foundation** for Phase 2 (dashboard, plugins, Asana integration, auto-fix pipeline)

---

## Task 1: Save Spec Documentation

Create `agent-os/specs/2026-02-12-mvp-refactoring/` with:
- `plan.md` — This full plan
- `shape.md` — Shaping notes from our conversation
- `references.md` — Pointers to current source files and ADK docs

---

## Task 2: Project Foundation — Types, Config, and Dependencies

**Goal**: Set up new project structure, install ADK, define all shared types and configuration.

### 2a. Install dependencies
```
bun add @google/adk
bun add -D @google/adk-devtools
bun add glob commander
```

### 2b. Update `package.json`
- Rename project from `junie-automatic-qa` to `adk-qa` (or chosen name)
- Update description
- Add `"type": "module"` for ESM (ADK requires it)
- Update scripts:
  - `"start": "bun src/index.ts"` — manual mode
  - `"test:auto": "bun src/index.ts --mode auto"` — automated mode
  - `"eval": "bun src/evals/index.ts"` — evaluations
  - `"dev": "npx adk web"` — ADK dev UI

### 2c. Update `tsconfig.json`
- Change `module` to `"ESNext"` (from CommonJS)
- Add `"moduleResolution": "bundler"`
- Add path aliases: `"paths": { "@/*": ["./src/*"] }`

### 2d. Create type definitions

**`src/types/test.ts`** — Test case and suite types:
```typescript
interface TestStep { index: number; instruction: string }
interface TestAssertion { description: string; passed?: boolean; evidence?: string }
interface TestCase {
  id: string; title: string; filePath: string;
  url: string; viewport: string; tags: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  steps: TestStep[]; expectedOutcome: string; assertions: TestAssertion[];
}
interface TestSuite { name: string; testCases: TestCase[] }
```

**`src/types/report.ts`** — Bug report and run result types:
```typescript
interface BugReport {
  id: string; severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'functional' | 'visual' | 'seo' | 'accessibility' | 'translation';
  title: string; description: string; url: string; viewport: string;
  steps: string[]; expected: string; actual: string;
  screenshots: string[]; timestamp: string;
}
interface TestCaseResult {
  testId: string; title: string;
  status: 'passed' | 'failed' | 'inconclusive' | 'error';
  duration: number; bugs: BugReport[]; screenshots: string[];
  agentOutput: string; error?: string;
}
interface TestRunResult {
  runId: string; timestamp: string; gitCommit?: string;
  results: TestCaseResult[];
  summary: { total: number; passed: number; failed: number; duration: number };
}
```

**`src/types/browser.ts`** — Browser and element types

**`src/types/index.ts`** — Barrel re-exports

### 2e. Create config system

**`src/config/schema.ts`** — Zod schemas for all config:
- `apiKey`, `models` (per agent: navigator, validator, reporter, evaluator)
- `headless`, `viewports` (array of `{name, width, height}` presets)
- `maxNavigationIterations`, `screenshotQuality`, `actionDelay`
- `testDir`, `reportDir`, `runHistoryDir`
- `debug`, `saveDebugScreenshots`

**`src/config/index.ts`** — Load config from env vars + defaults, validate with Zod

**`src/config/models.ts`** — Model alias registry (flash, pro, etc.)

### 2f. Create `.env.example`

**Files to create**: `src/types/test.ts`, `src/types/report.ts`, `src/types/browser.ts`, `src/types/index.ts`, `src/config/schema.ts`, `src/config/index.ts`, `src/config/models.ts`, `.env.example`

**Verification**: `bun run build` succeeds. Existing code still works.

---

## Task 3: Refactor Browser Module

**Goal**: Extract the monolithic `src/browser/index.ts` (266 lines) into a clean class-based module with viewport support.

### 3a. `src/browser/manager.ts` — BrowserManager class
- Wraps Puppeteer `browser` and `page` (currently module-level globals at `src/browser/index.ts:3-4`)
- Constructor takes `ViewportConfig` (supports mobile/desktop presets)
- Methods: `launch()`, `close()`, `getPage()`
- Singleton pattern via `getBrowserManager()` export

### 3b. `src/browser/page-actions.ts` — Pure functions
- Port: `navigateTo` (line 35), `scrollPage` (line 41), `clickElement` (line 221), `typeElement` (line 230), `pressKey` (line 262), `getScreenshot` (line 244)
- Each function takes `Page` from BrowserManager instead of using module-level `page`

### 3c. `src/browser/visual-tagger.ts` — Set-of-Mark system
- Extract `tagElements` function (lines 56-218) — this is the core innovation, preserve exactly
- Keep the smart label positioning logic (3-mode: top-left, top-right, bottom-left)
- Keep the `aiElementMap` global and `target="_blank"` prevention

### 3d. `src/browser/index.ts` — Barrel exports
- Re-export all public functions
- Provide backward-compatible free-function wrappers during migration

### 3e. Add viewport presets
- Desktop: 1280x1000 (current)
- Mobile: 375x812 (iPhone), 390x844 (iPhone Pro)
- Tablet: 768x1024 (iPad)
- Configurable via `src/config/schema.ts`

**Files to modify**: `src/browser/index.ts` (split into 4 files)
**Verification**: `bun src/index.ts "Go to guidetoiceland.is"` still works with refactored browser module.

---

## Task 4: Create ADK Tools

**Goal**: Rewrite all tools as ADK `FunctionTool` instances. These are decoupled from agents.

### 4a. `src/tools/navigation.ts`
- `navigateTool` — Navigate to URL, auto-screenshot after
- `scrollTool` — Scroll page, auto-screenshot after

### 4b. `src/tools/interaction.ts`
- `clickElementTool` — Click element by visual ID
- `typeElementTool` — Type text into element by ID
- `pressKeyTool` — Press keyboard key

### 4c. `src/tools/observation.ts`
- `takeScreenshotTool` — Explicitly take screenshot with element tagging
- `getElementListTool` — Return current element metadata without screenshot

### 4d. `src/tools/reporting.ts`
- `recordBugTool` — Record a bug finding (saves to session state)
- `recordAssertionTool` — Record a pass/fail assertion

### 4e. `src/tools/loop-control.ts`
- `taskCompletedTool` — Sets `toolContext.actions.escalate = true` to exit the LoopAgent

**Key design**: Browser action tools (navigate, click, type, scroll, pressKey) automatically take a screenshot and save it + element list to `temp:` state after executing. The navigator agent's `beforeModelCallback` reads this state and injects the screenshot image into the next model request. This replicates the current behavior at `src/agent/index.ts:270-296`.

```typescript
// Pattern for browser tools:
execute: async ({ url }, toolContext) => {
  const browser = getBrowserManager();
  await browser.getPage().navigateTo(url);
  // Auto-screenshot
  const elements = await tagElements(0);
  const screenshot = await getScreenshot();
  toolContext.state.set('temp:latest_screenshot', screenshot);
  toolContext.state.set('temp:latest_elements', JSON.stringify(elements));
  return { status: 'success', message: `Navigated to ${url}`, elementCount: elements.length };
}
```

**Files to create**: `src/tools/navigation.ts`, `src/tools/interaction.ts`, `src/tools/observation.ts`, `src/tools/reporting.ts`, `src/tools/loop-control.ts`, `src/tools/index.ts`

**Verification**: Tools can be instantiated and their `execute()` called in a test script.

---

## Task 5: Build Multi-Agent Architecture on ADK

**Goal**: Replace the single Genkit agent loop (`src/agent/index.ts`) with ADK multi-agent setup.

### 5a. `src/agents/navigator.ts` — NavigatorAgent (LlmAgent inside LoopAgent)

The navigator is an `LlmAgent` that handles page interaction. It reuses the system prompt from `src/agent/index.ts:158-188` but parameterized:

```typescript
const navigator = new LlmAgent({
  name: 'navigator',
  model: config.models.navigator,  // e.g. 'gemini-2.5-flash'
  instruction: `You are a QA automation expert...
    Your goal is to complete these test steps sequentially:
    {task_steps}
    {url_hint}

    After each action, a screenshot will be injected automatically.
    When ALL steps are completed, call the task_completed tool.`,
  tools: [navigateTool, scrollTool, clickElementTool, typeElementTool, pressKeyTool, taskCompletedTool],
  outputKey: 'navigation_result',
  beforeModelCallback: injectScreenshotCallback,  // Injects latest screenshot into request
});

// Wrap in LoopAgent (replaces the for-loop at src/agent/index.ts:197)
const navigatorLoop = new LoopAgent({
  name: 'navigator_loop',
  subAgents: [navigator],
  maxIterations: config.maxNavigationIterations,  // default 20
});
```

**`injectScreenshotCallback`**: Reads `temp:latest_screenshot` and `temp:latest_elements` from state, adds image part to the model request. This replaces the manual `currentInput` building at `src/agent/index.ts:286-296`.

### 5b. `src/agents/validator.ts` — ValidatorAgent (LlmAgent)

Evaluates outcomes against expected criteria (replaces `evaluateResult` at `src/evals.ts:62-92`):

```typescript
const validator = new LlmAgent({
  name: 'validator',
  model: config.models.validator,
  instruction: `Review the navigation result: {navigation_result}
    Against expected criteria: {expected_criteria}
    Take a screenshot to verify current state.
    Record assertions using recordAssertion tool.
    Determine: PASS, FAIL, or INCONCLUSIVE with reasoning.`,
  tools: [takeScreenshotTool, recordAssertionTool],
  outputKey: 'validation_result',
});
```

### 5c. `src/agents/reporter.ts` — ReporterAgent (LlmAgent)

Compiles findings into structured report:

```typescript
const reporter = new LlmAgent({
  name: 'reporter',
  model: config.models.reporter,
  instruction: `Generate a structured QA report from:
    Navigation result: {navigation_result}
    Validation: {validation_result}
    Record any bugs found using recordBug tool.`,
  tools: [recordBugTool],
  outputKey: 'final_report',
});
```

### 5d. `src/agents/orchestrator.ts` — OrchestratorAgent (custom BaseAgent)

Deterministic orchestration (not LLM-driven):

```typescript
class OrchestratorAgent extends BaseAgent {
  async *runAsyncImpl(ctx: InvocationContext): AsyncGenerator<Event> {
    // Phase 1: Navigate and interact
    for await (const event of this.navigatorLoop.runAsync(ctx)) yield event;
    // Phase 2: Validate outcomes
    for await (const event of this.validator.runAsync(ctx)) yield event;
    // Phase 3: Generate report
    for await (const event of this.reporter.runAsync(ctx)) yield event;
  }
}
```

### 5e. `src/agents/index.ts` — Runner factory

```typescript
export function createRunner(config: AppConfig) {
  const orchestrator = buildOrchestratorAgent(config);
  return new InMemoryRunner({ agent: orchestrator, appName: 'adk-qa' });
}
```

### 5f. Rewrite `src/index.ts` — New CLI entry point

Use `commander` for CLI args:
- `bun src/index.ts manual "task description"` — manual QA mode
- `bun src/index.ts auto --test-dir ./tests` — automated mode
- `bun src/index.ts auto --test-file ./tests/search-car.md` — single test

Programmatic execution:
```typescript
const runner = createRunner(config);
const session = await runner.sessionService.createSession({
  appName: 'adk-qa', userId: 'cli', state: { task_steps: formattedTask }
});
for await (const event of runner.runAsync(userId, sessionId, content)) {
  // Collect results
}
```

### 5g. Delete legacy files
- `src/genkit.ts` (12 lines — Genkit init)
- `src/googleGenai.ts` (183 lines — custom Gemini adapter, no longer needed)
- `src/agent/index.ts` (315 lines — old agent loop, fully replaced)
- `src/knowledge/index.ts` (47 lines — hardcoded knowledge base)
- Remove Genkit deps from `package.json`: `@genkit-ai/ai`, `@genkit-ai/core`, `@genkit-ai/dotprompt`, `@genkit-ai/flow`, `genkit`

**Files to create**: `src/agents/navigator.ts`, `src/agents/validator.ts`, `src/agents/reporter.ts`, `src/agents/orchestrator.ts`, `src/agents/index.ts`, `src/agents/callbacks.ts`
**Files to modify**: `src/index.ts` (rewrite)
**Files to delete**: `src/genkit.ts`, `src/googleGenai.ts`, `src/agent/index.ts`, `src/knowledge/index.ts`

**Verification**: `bun src/index.ts manual "Go to guidetoiceland.is and check homepage loads"` works end-to-end using ADK.

---

## Task 6: Markdown Test Definitions and Automated Mode

**Goal**: Enable test case definitions as markdown files, with discovery and batch execution.

### 6a. Define test file format

```markdown
# Search Car Rental

## Metadata
- **url**: https://guidetoiceland.is
- **viewport**: desktop
- **tags**: search, cars, booking
- **priority**: high

## Steps
1. Navigate to the homepage
2. Click on the 'Cars' tab element
3. Choose 'Reykjavik, Iceland' from the dropdown
...

## Expected Outcome
Search results page loads with car rental listings visible.

## Assertions
- [ ] Search results page is displayed
- [ ] At least one car listing is visible
```

### 6b. `src/tests/parser.ts` — Parse markdown into `TestCase`
- Extract `# Title` as test title
- Parse `## Metadata` section for url, viewport, tags, priority
- Parse `## Steps` as ordered `TestStep[]`
- Parse `## Expected Outcome` as string
- Parse `## Assertions` (checkbox items) as `TestAssertion[]`

### 6c. `src/tests/discovery.ts` — Find test files
- Glob `testDir/**/*.md` for test files
- Parse each, return `TestSuite`

### 6d. `src/tests/runner.ts` — Execute test suite
- For each test case: create session with test data in state, run orchestrator, collect results
- Support `--viewport` override and `--test-file` single-file mode
- Return `TestRunResult`

### 6e. Create sample test files from current evals
- `tests/search-car-rental.md` — from `src/evals.ts:19-31`
- `tests/search-tour.md` — from `src/evals.ts:33-46`

**Files to create**: `src/tests/parser.ts`, `src/tests/discovery.ts`, `src/tests/runner.ts`, `tests/search-car-rental.md`, `tests/search-tour.md`
**Verification**: `bun src/index.ts auto --test-dir ./tests` discovers and runs both test files.

---

## Task 7: Run Memory and Regression Detection

**Goal**: Persist test run results and compare across runs to detect regressions.

### 7a. `src/memory/run-store.ts`
- Save `TestRunResult` as JSON to `.qa-runs/{timestamp}_{runId}.json`
- Maintain `latest.json` symlink
- Save screenshots to `.qa-runs/screenshots/{runId}/`
- Load previous runs for comparison

### 7b. `src/memory/regression.ts`
- `detectRegressions(current, previous)` → `RegressionReport`
- Regression = test that was `passed` but is now `failed`
- Improvement = test that was `failed` but is now `passed`
- Include test ID, previous/current status, details

### 7c. Integrate into test runner
- After each automated run, save results via run-store
- Compare against latest previous run, output regression report

### 7d. Delete old memory module
- Delete `src/memory/index.ts` (78 lines — old conversation memory)
- Delete `memory.json`, `memory.test.json` (old data files)

**Files to create**: `src/memory/run-store.ts`, `src/memory/regression.ts`, `src/memory/index.ts` (new barrel)
**Files to delete**: old `src/memory/index.ts`
**Verification**: Run tests twice, second run shows comparison against first.

---

## Task 8: Bug Reporting and Report Generation

**Goal**: Generate structured, human-readable reports after each test run.

### 8a. `src/reports/formatter.ts`
- Format `TestRunResult` + `RegressionReport` into markdown
- Include: summary, regressions, failed tests with bug details, passed tests
- Reference screenshots

### 8b. `src/reports/writer.ts`
- Write markdown report to `reports/{timestamp}_report.md`
- Write JSON to `reports/{timestamp}_report.json`

### 8c. Integrate into test runner
- Auto-generate report after each run
- Print summary to console

**Files to create**: `src/reports/formatter.ts`, `src/reports/writer.ts`, `src/reports/index.ts`
**Verification**: After a run, `reports/` contains timestamped markdown and JSON files.

---

## Task 9: Evals Migration and Cleanup

**Goal**: Migrate eval system to use the new infrastructure, clean up legacy code.

### 9a. `src/evals/index.ts` — Rewrite using test runner
- Use `src/tests/runner.ts` to execute test cases
- Evaluator uses LLM to assess results (preserve logic from `src/evals.ts:62-92`)
- Output pass/fail with exit code for CI

### 9b. `src/evals/dataset.ts` — Extract eval dataset
- Convert hardcoded test cases from `src/evals.ts:12-60` to the new `TestCase` format
- Point to the markdown test files in `tests/`

### 9c. Delete old evals
- Delete `src/evals.ts` (169 lines)
- Delete `eval_output.txt`, `find_models.js`, `test-genai.js`, `models_output.txt`

**Files to create**: `src/evals/index.ts`, `src/evals/dataset.ts`
**Files to delete**: `src/evals.ts`, `eval_output.txt`, `find_models.js`, `test-genai.js`, `models_output.txt`

---

## Task 10: Documentation and CI

### 10a. Update `README.md`
- New project name and description
- Architecture overview (multi-agent, ADK-based)
- Setup instructions (Bun, env vars)
- Usage: manual mode, automated mode, writing test files
- Config reference

### 10b. Update `package.json` scripts
- Final script definitions for all modes

### 10c. Create `.github/workflows/qa.yml`
- GitHub Actions workflow for automated QA runs
- Runs `bun src/index.ts auto --test-dir ./tests --headless`
- Uploads reports as artifacts
- Fails on regressions

### 10d. Create `.env.example`
```
GOOGLE_GENAI_API_KEY=your_key_here
HEADLESS=true
GOOGLE_GENAI_MODEL=gemini-2.5-flash
```

### 10e. Update `.gitignore`
- Add `.qa-runs/`, `reports/`, `debug/`

### 10f. Clean up
- Remove `junie-automatic-qa/` subdirectory
- Remove `dist/` (will be regenerated)
- Remove stale `.DS_Store`

---

## Target Project Structure (Final)

```
src/
├── index.ts                     # CLI entry point (commander)
├── config/
│   ├── index.ts                 # Config loader
│   ├── schema.ts                # Zod schemas
│   └── models.ts                # Model alias registry
├── types/
│   ├── index.ts                 # Re-exports
│   ├── test.ts                  # TestCase, TestStep, TestSuite
│   ├── report.ts                # BugReport, TestRunResult, RegressionReport
│   └── browser.ts               # ElementMetadata, ViewportConfig
├── agents/
│   ├── index.ts                 # Runner factory (createRunner)
│   ├── orchestrator.ts          # Custom BaseAgent: navigator → validator → reporter
│   ├── navigator.ts             # LlmAgent + LoopAgent for page interaction
│   ├── validator.ts             # LlmAgent for assertion checking
│   ├── reporter.ts              # LlmAgent for report generation
│   └── callbacks.ts             # beforeModelCallback (screenshot injection)
├── tools/
│   ├── index.ts                 # Re-exports
│   ├── navigation.ts            # navigate, scroll
│   ├── interaction.ts           # clickElement, typeElement, pressKey
│   ├── observation.ts           # takeScreenshot, getElementList
│   ├── reporting.ts             # recordBug, recordAssertion
│   └── loop-control.ts          # taskCompleted (escalate)
├── browser/
│   ├── index.ts                 # Re-exports
│   ├── manager.ts               # BrowserManager class (singleton)
│   ├── page-actions.ts          # navigateTo, scroll, click, type, etc.
│   └── visual-tagger.ts         # Set-of-Mark tagging (preserved from current)
├── tests/
│   ├── parser.ts                # Markdown test file parser
│   ├── discovery.ts             # Glob-based test discovery
│   └── runner.ts                # Test suite executor
├── memory/
│   ├── index.ts                 # Re-exports
│   ├── run-store.ts             # Persist TestRunResult to .qa-runs/
│   └── regression.ts            # Compare runs, detect regressions
├── reports/
│   ├── formatter.ts             # Format results as markdown
│   └── writer.ts                # Write reports to disk
└── evals/
    ├── index.ts                 # Eval entry point
    └── dataset.ts               # Eval test dataset
tests/
├── search-car-rental.md         # Sample test file
└── search-tour.md               # Sample test file
```

---

## Dependency Changes

**Remove**: `@genkit-ai/ai`, `@genkit-ai/core`, `@genkit-ai/dotprompt`, `@genkit-ai/flow`, `genkit`
**Add**: `@google/adk`, `@google/adk-devtools` (dev), `commander`, `glob`
**Keep**: `@google/genai`, `puppeteer`, `winston`, `zod`, all devDeps

---

## Key Risks

1. **ADK requires Node.js 24.13+** — Verify Bun compatibility early in Task 2. If issues arise, may need to use Node.js directly or report Bun bugs.
2. **Screenshot injection** — ADK doesn't natively support injecting images between agent turns. The `beforeModelCallback` approach must be validated in Task 5a.
3. **Genkit removal is all-or-nothing for tools** — Tasks 4 and 5 should be done together in one working session since you can't mix Genkit and ADK tool registrations.

---

## Verification Plan

After each task, verify the project runs:

| Task | Verification Command | Expected |
|------|---------------------|----------|
| 2 | `bun run build` | Compiles without errors |
| 3 | `bun src/index.ts "Go to guidetoiceland.is"` | Works with refactored browser |
| 4+5 | `bun src/index.ts manual "Go to guidetoiceland.is and check homepage"` | Full ADK flow works |
| 6 | `bun src/index.ts auto --test-dir ./tests` | Discovers and runs 2 test files |
| 7 | Run auto twice, check `.qa-runs/` | Second run shows regression comparison |
| 8 | Check `reports/` after run | Contains markdown + JSON reports |
| 9 | `bun src/evals/index.ts` | Evals pass using new infrastructure |
| 10 | `bun run build && bun run lint` | Clean build, CI config present |
