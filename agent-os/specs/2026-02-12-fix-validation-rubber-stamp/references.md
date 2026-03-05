# References for Fix Validation Rubber-Stamp

## Agent Architecture

### Orchestrator Agent

- **Location:** `src/agents/orchestrator.ts`
- **Relevance:** Custom BaseAgent that sequences navigator -> validator -> reporter. Contains stateDelta propagation logic that is the primary mechanism for getting `validation_result` into session state.
- **Key patterns:** `Object.assign(ctx.session.state, event.actions.stateDelta)` on each event. Three-phase sequential execution.

### Validator Agent

- **Location:** `src/agents/validator.ts`
- **Relevance:** Core of the rubber-stamp problem. Vague instruction, missing screenshot callback, no assertion list injection.
- **Key patterns:** `outputKey: 'validation_result'`, template variables `{navigation_result}` and `{expected_criteria}`.

### Navigator Agent

- **Location:** `src/agents/navigator.ts`
- **Relevance:** Uses `LoopAgent` wrapper with `injectScreenshotCallback`. Template variables `{task_steps}` and `{url_hint}`. Has `outputKey: 'navigation_result'`.
- **Key patterns:** The `taskCompletedTool` in `src/tools/loop-control.ts` manually sets `navigation_result` via `toolContext.state.set()` to work around LoopAgent + escalate bypassing `outputKey`. Same pattern needed for validator.

### Reporter Agent

- **Location:** `src/agents/reporter.ts`
- **Relevance:** Generates final report. Currently minimal instruction. Needs `{test_assertions}` context.
- **Key patterns:** `outputKey: 'final_report'`, uses `recordBugTool`.

### Screenshot Callback

- **Location:** `src/agents/callbacks.ts`
- **Relevance:** Injects `latest_screenshot` and `latest_elements` into LLM requests. Currently only used by navigator, but validator needs it too.
- **Key patterns:** Reads from state, pushes `inlineData` image part + text elements into `request.contents`.

## Test Infrastructure

### Test Runner

- **Location:** `src/tests/runner.ts`
- **Relevance:** Creates session state (lines 27-36), reads `validation_result` (line 69), determines status (lines 86-98), builds summary (lines 140-145).
- **Key patterns:** Fallback to assertions when `validation_result` is empty. Session state is the bridge between agents and the runner.

### Test Parser

- **Location:** `src/tests/parser.ts`
- **Relevance:** Parses markdown test files. Extracts assertions as `{ description, passed }` from checkbox syntax. The `passed` field from parsing represents whether the checkbox was checked in the source file (not runtime result).
- **Key patterns:** Regex-based section parsing. `TestAssertion` type with optional `passed` and `evidence`.

### Test Types

- **Location:** `src/types/test.ts`
- **Relevance:** `TestCase` includes `assertions: TestAssertion[]` but this array is never passed to session state.

## Tools

### Reporting Tools

- **Location:** `src/tools/reporting.ts`
- **Relevance:** `recordAssertionTool` stores assertions to state as JSON array. `recordBugTool` stores bugs to state. Both use `toolContext.state.set()`.
- **Key patterns:** Assertions have `{ description, passed, evidence, timestamp }`. Bugs have `{ severity, category, title, description, expected, actual }`.

### Loop Control

- **Location:** `src/tools/loop-control.ts`
- **Relevance:** `taskCompletedTool` manually sets `navigation_result` state because LoopAgent + `escalate = true` bypasses `outputKey`. Documents the ADK state propagation issue.

## Reports & Formatting

### Report Formatter

- **Location:** `src/reports/formatter.ts`
- **Relevance:** Generates markdown reports. Currently shows bugs for failed tests but no assertion details.

### Report Writer

- **Location:** `src/reports/writer.ts`
- **Relevance:** Writes markdown and JSON reports to `reports/` directory.

### Report Types

- **Location:** `src/types/report.ts`
- **Relevance:** `TestCaseResult` currently has `bugs`, `screenshots`, `agentOutput` but no `assertions` or `validationOutput` fields.

## Evaluation System

### Eval Entry Point

- **Location:** `src/evals/index.ts`
- **Relevance:** Currently just runs all test files and reports pass/fail counts. No concept of "expected outcome" for the eval itself.

### Eval Dataset

- **Location:** `src/evals/dataset.ts`
- **Relevance:** Discovers markdown test files from `tests/` directory. Needs to be replaced/augmented with an eval dataset that maps test files to expected outcomes.

## Evidence of the Rubber-Stamp Problem

### Test Run Reports

- **Location:** `reports/report_run-1770867952020.json`
- **Evidence:** Search Tour test found a "Date range picker for tour search is not interactive" bug (medium severity) but was still marked `status: "passed"`. Both tests passed with `summary: { passed: 2, failed: 0 }`.

### Prior Spec

- **Location:** `agent-os/specs/2026-02-12-mvp-refactoring/fix-test-validation.md`
- **Relevance:** Identified `validation_result` empty state and summary counting issues. Fixes 2-3 from that spec have been applied. Fix 1 (manual state propagation) partially applied. Fix 4 (template variable verification) not yet addressed.
