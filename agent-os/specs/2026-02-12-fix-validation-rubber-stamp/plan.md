# Fix Validation Rubber-Stamp & Build Eval Framework

## Context

The QA automation tool's validation system is broken: **tests always pass regardless of actual outcomes**. The validator agent rubber-stamps PASS on everything, including tests where bugs were found (e.g., Search Tour found a non-interactive date picker but still passed). This undermines the core value proposition of reliable, AI-powered QA verdicts.

**Root causes:**
1. Validator lacks the assertion list -- `testCase.assertions` is never passed to session state
2. Validator instruction is too vague -- no hard rules for PASS vs FAIL
3. Validator can't see the page -- missing `beforeModelCallback: injectScreenshotCallback`
4. No structural safeguard -- a test with serious bugs can still be marked PASS
5. `validation_result` propagation is fragile -- ADK `outputKey` only fires on `isFinalResponse()` events
6. No negative tests or eval framework -- no way to measure validation accuracy

---

## Task 1: Save Spec Documentation

Create `agent-os/specs/2026-02-12-fix-validation-rubber-stamp/` with:
- **plan.md** -- This plan
- **shape.md** -- Shaping notes
- **references.md** -- Code references

---

## Task 2: Pass Test Assertions to Validator via Session State

**File: `src/tests/runner.ts`** (lines 27-36)

Add `test_assertions` to the session state when creating a session:

```typescript
state: {
  task_steps: formattedSteps,
  url_hint: testCase.url,
  expected_criteria: testCase.expectedOutcome,
  current_viewport: testCase.viewport,
  test_assertions: JSON.stringify(
    testCase.assertions.map((a, i) => ({
      id: i + 1,
      description: a.description,
    }))
  ),
}
```

This makes the assertion list available to the validator as `{test_assertions}` in its instruction template.

---

## Task 3: Rewrite Validator Instruction to Be Strict

**File: `src/agents/validator.ts`**

Replace the entire instruction with strict, objective validation rules:

```typescript
import { LlmAgent } from '@google/adk';
import { type AppConfig } from '../config/schema.js';
import { takeScreenshotTool, recordAssertionTool } from '../tools/index.js';
import { injectScreenshotCallback } from './callbacks.js';

export function buildValidatorAgent(config: AppConfig) {
  return new LlmAgent({
    name: 'validator',
    model: config.models.validator,
    instruction: `You are a STRICT QA validation agent. Your job is to determine whether a test PASSED or FAILED based on objective evidence from the current page state.

NAVIGATION SUMMARY:
{navigation_result}

EXPECTED OUTCOME:
{expected_criteria}

SPECIFIC ASSERTIONS TO VALIDATE:
{test_assertions}

VALIDATION PROCEDURE:
1. Take a screenshot using the 'take_screenshot' tool to capture the CURRENT page state.
2. For EACH assertion listed above, evaluate it against what you see in the screenshot:
   - If the assertion is clearly satisfied by visible evidence on screen, record it as passed with specific evidence (e.g., "Visible: 12 tour cards in search results grid").
   - If the assertion is NOT satisfied or you CANNOT confirm it from the screenshot, record it as FAILED with a specific reason (e.g., "No search results visible; page shows error message").
   - Do NOT assume an assertion passes. You must see clear evidence on screen.
3. Use the 'record_assertion' tool for EACH assertion.

DECISION RULES (follow these EXACTLY):
- PASS: ALL assertions are satisfied AND the expected outcome is met.
- FAIL: ANY assertion is not satisfied OR the expected outcome is not met.
- INCONCLUSIVE: You cannot determine the result (e.g., page did not load, screenshot is blank, navigation did not complete).

ANTI-RUBBER-STAMP RULES:
- If the navigation summary mentions ANY errors, failures, or workarounds, carefully verify each assertion rather than assuming success.
- When in doubt, mark as FAIL rather than PASS. False passes are worse than false failures.
- Every assertion MUST have specific visual evidence. "Looks correct" is NOT valid evidence.

Your final message MUST end with exactly one of these words on its own line: PASS, FAIL, or INCONCLUSIVE.`,
    tools: [takeScreenshotTool, recordAssertionTool],
    outputKey: 'validation_result',
    beforeModelCallback: injectScreenshotCallback,
  });
}
```

Key changes:
- Add `beforeModelCallback: injectScreenshotCallback` so the validator can SEE the page
- Inject `{test_assertions}` template variable
- Explicit anti-rubber-stamp rules
- Require final message to end with PASS/FAIL/INCONCLUSIVE

---

## Task 4: Add Structural Safeguards in Test Runner

**File: `src/tests/runner.ts`** (lines 86-98)

Replace status determination with multi-signal logic:

```typescript
// Signal 1: validation_result text
const validationVerdict = validationResult.toUpperCase();
const validatorSaysPass = validationVerdict.includes('PASS') && !validationVerdict.includes('FAIL');
const validatorSaysFail = validationVerdict.includes('FAIL');

// Signal 2: recorded assertions
const hasAssertions = assertions.length > 0;
const allAssertionsPassed = hasAssertions && assertions.every((a: any) => a.passed === true);
const anyAssertionFailed = hasAssertions && assertions.some((a: any) => a.passed === false);

// Signal 3: bugs found (structural safeguard)
const hasSeriousBugs = bugs.some((b: BugReport) =>
  ['critical', 'high', 'medium'].includes(b.severity)
);

// Decision logic with structural safeguards
if (validatorSaysFail || anyAssertionFailed) {
  status = 'failed';
} else if (hasSeriousBugs) {
  status = 'failed';
} else if (validatorSaysPass && (!hasAssertions || allAssertionsPassed)) {
  status = 'passed';
} else if (hasAssertions && allAssertionsPassed) {
  status = 'passed';
} else if (!validationResult && !hasAssertions) {
  status = 'inconclusive';
} else {
  status = 'inconclusive';
}
```

**File: `src/types/report.ts`**

Add `AssertionResult` interface and expand `TestCaseResult`:

```typescript
export interface AssertionResult {
  description: string;
  passed: boolean;
  evidence?: string;
  timestamp: string;
}

export interface TestCaseResult {
  testId: string;
  title: string;
  status: 'passed' | 'failed' | 'inconclusive' | 'error';
  duration: number;
  bugs: BugReport[];
  assertions: AssertionResult[];   // NEW
  screenshots: string[];
  agentOutput: string;
  validationOutput?: string;       // NEW
  error?: string;
}
```

---

## Task 5: Harden `validation_result` Propagation

**File: `src/agents/orchestrator.ts`** (lines 38-44)

Add explicit capture of `validation_result` from validator events:

```typescript
// Phase 2: Validate outcomes -- capture validation_result explicitly
let capturedValidationResult = '';
for await (const event of this.validator.runAsync(ctx)) {
  if (event.actions?.stateDelta) {
    Object.assign(ctx.session.state, event.actions.stateDelta);
    if (event.actions.stateDelta['validation_result']) {
      capturedValidationResult = event.actions.stateDelta['validation_result'];
    }
  }
  yield event;
}
// Safety net
if (capturedValidationResult && !ctx.session.state['validation_result']) {
  ctx.session.state['validation_result'] = capturedValidationResult;
}
```

---

## Task 6: Improve Reporter Output

**File: `src/agents/reporter.ts`**

Update instruction to reference `{test_assertions}` and produce structured output:

```typescript
instruction: `Generate a structured QA report from the following inputs:

Navigation Result: {navigation_result}
Validation Result: {validation_result}
Test Assertions: {test_assertions}

Your task:
1. Start with a one-line VERDICT: PASS, FAIL, or INCONCLUSIVE.
2. Summarize what was tested (URL, key actions taken).
3. List each assertion and its result (passed/failed with evidence).
4. If any bugs or discrepancies were found, record them using the 'record_bug' tool with appropriate severity.
5. End with any recommendations or observations.

Format the report for an engineering team.`,
```

**File: `src/reports/formatter.ts`**

Add assertion results section to markdown reports showing each assertion's pass/fail status and evidence.

---

## Task 7: Create Negative Test Scenarios

Create `tests/negative/` with 4 test files designed to FAIL:

### `tests/negative/wrong-url-tour.md`
Navigate to a 404 page (`/this-page-does-not-exist-404`), assert tour results exist.

### `tests/negative/impossible-element.md`
Navigate to car rental page, assert "Buy Cryptocurrency" button exists.

### `tests/negative/wrong-content-assertion.md`
Navigate to guidetoiceland.is, assert Amazon product listings visible.

### `tests/negative/missing-search-results.md`
Search nonsense query "xyznonexistent999", assert exactly 500 results.

---

## Task 8: Build Eval Framework

**New file: `src/evals/eval-types.ts`**
- `EvalCase`: maps test file to expected status (passed/failed)
- `EvalResult`: expected vs actual with correctness flag
- `EvalRunResult`: accuracy, false positives, false negatives

**New file: `src/evals/eval-dataset.ts`**
- 2 positive tests (should PASS): search-tour.md, search-car-rental.md
- 4 negative tests (should FAIL): the 4 negative tests

**Modify: `src/evals/index.ts`**
- Import eval dataset, run each case, compare actual vs expected
- Track accuracy, false positives (expected FAIL got PASS), false negatives
- Exit 0 on 100% accuracy, exit 1 otherwise

---

## Verification

1. `bun run build` -- TypeScript compiles without errors
2. `bun run test:auto` -- Positive tests should PASS (or FAIL with bugs = correct)
3. `bun src/index.ts auto --test-dir tests/negative` -- All 4 should FAIL
4. `bun run eval` -- 100% accuracy (6/6 correct verdicts)
5. Check reports -- Markdown reports include assertion details
6. Confirm Search Tour test FAILS if date picker bug is found (structural safeguard)