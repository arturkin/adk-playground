# Fix: test:auto Shows 0 Passed / 0 Failed

## Problem

When running `bun run test:auto`, the summary shows `Passed: 0, Failed: 0` with `Total: 2`. This means every test result is classified as `inconclusive` — neither passed nor failed. Two root causes are identified.

---

## Root Cause Analysis

### RC1: `validation_result` is empty or missing from session state

In `src/tests/runner.ts:69`, the runner reads:
```typescript
const validationResult = (sessionDetails?.state?.['validation_result'] as string) || '';
```

Then classifies the result at line 83:
```typescript
const status = validationResult.toUpperCase().includes('PASS') ? 'passed' :
               validationResult.toUpperCase().includes('FAIL') ? 'failed' : 'inconclusive';
```

If `validation_result` is empty or doesn't contain "PASS"/"FAIL", the status is always `inconclusive`.

**Why it's empty**: The ADK `outputKey` mechanism saves the agent's final text response to `stateDelta` on the event. However, the `OrchestratorAgent` is a custom `BaseAgent` that calls sub-agents via `yield*`. The state delta from sub-agent events may not be applied to the session properly because:

1. The `OrchestratorAgent` yields events from sub-agents, but the `InMemoryRunner` may not process `stateDelta` from events yielded by a custom `BaseAgent`'s `runAsyncImpl`.
2. The validator agent's `outputKey: 'validation_result'` only saves on `isFinalResponse(event)` — if the validator's last event isn't recognized as a final response (e.g., it ends with a tool call instead of text), nothing is saved.

### RC2: Summary only counts `passed` and `failed`, ignoring `inconclusive` and `error`

In `src/tests/runner.ts:127-128`:
```typescript
const passed = results.filter(r => r.status === 'passed').length;
const failed = results.filter(r => r.status === 'failed' || r.status === 'error').length;
```

Tests with `inconclusive` status are counted in `total` but not in `passed` or `failed`, making the summary misleading.

---

## Fix Plan

### Fix 1: Ensure validator output reaches session state

**File**: `src/agents/orchestrator.ts`

**Option A** (Recommended): Instead of relying on `outputKey` state propagation through the custom BaseAgent, manually read the validator's output from events and set it on the invocation context's session state.

```typescript
async *runAsyncImpl(ctx: InvocationContext): AsyncGenerator<Event> {
  // Phase 1: Navigate
  yield* this.navigatorLoop.runAsync(ctx);

  // Phase 2: Validate — capture output
  let validationOutput = '';
  for await (const event of this.validator.runAsync(ctx)) {
    if (event.actions?.stateDelta?.['validation_result']) {
      validationOutput = event.actions.stateDelta['validation_result'];
    }
    yield event;
  }
  // Ensure state is set even if stateDelta wasn't auto-applied
  if (validationOutput) {
    ctx.session.state['validation_result'] = validationOutput;
  }

  // Phase 3: Report — same pattern
  for await (const event of this.reporter.runAsync(ctx)) {
    if (event.actions?.stateDelta?.['final_report']) {
      ctx.session.state['final_report'] = event.actions.stateDelta['final_report'];
    }
    yield event;
  }
}
```

**Option B** (Simpler fallback): After the runner finishes, scan all events for the validator's text output and use that for classification instead of relying on session state.

### Fix 2: Improve result classification robustness

**File**: `src/tests/runner.ts`

Add a fallback: if `validation_result` is empty, check `assertions` state (which `recordAssertionTool` populates) to determine pass/fail:

```typescript
// After reading session state:
const validationResult = (sessionDetails?.state?.['validation_result'] as string) || '';
const assertionsJson = (sessionDetails?.state?.['assertions'] as string) || '[]';
const assertions = JSON.parse(assertionsJson);

let status: 'passed' | 'failed' | 'inconclusive' | 'error';

if (validationResult.toUpperCase().includes('PASS')) {
  status = 'passed';
} else if (validationResult.toUpperCase().includes('FAIL')) {
  status = 'failed';
} else if (assertions.length > 0) {
  // Fallback: use recorded assertions
  const allPassed = assertions.every((a: any) => a.passed === true);
  const anyFailed = assertions.some((a: any) => a.passed === false);
  status = anyFailed ? 'failed' : allPassed ? 'passed' : 'inconclusive';
} else {
  status = 'inconclusive';
}
```

### Fix 3: Count `inconclusive` and `error` in summary

**File**: `src/tests/runner.ts`

Add inconclusive/error counts to the summary output, and treat `inconclusive` as a warning:

```typescript
const inconclusive = results.filter(r => r.status === 'inconclusive').length;
const errors = results.filter(r => r.status === 'error').length;
```

**File**: `src/index.ts` — Update the summary log to show these counts.

**File**: `src/types/report.ts` — Optionally add `inconclusive` and `errors` to the `summary` type.

### Fix 4: Verify navigator completes all steps

**File**: `src/agents/navigator.ts`

The navigator instruction uses `{task_steps}` and `{url_hint}` template variables which are populated from session state. Verify that:

1. ADK's template variable substitution (`{task_steps}`) actually works with session state keys. If not, the navigator gets instructions with literal `{task_steps}` text and doesn't know what to do.
2. If template substitution doesn't work, switch to building the instruction string manually in the orchestrator before running the navigator.

**Diagnostic step**: Add a `console.log` in the `injectScreenshotCallback` to print `context.state.get('task_steps')` and verify it's populated.

---

## Execution Order

1. **Diagnose first**: Add logging to confirm whether `task_steps` state is populated and whether `validation_result` state is set after a run. Run a single test with `--test-file`.
2. **Fix 1**: Update orchestrator to manually propagate state from sub-agent events.
3. **Fix 2**: Add assertion-based fallback for result classification.
4. **Fix 3**: Add inconclusive/error counts to summary.
5. **Fix 4**: If navigator isn't following steps, fix template variable substitution.
6. **Verify**: Run `bun run test:auto` and confirm summary shows non-zero passed/failed counts.

---

## Verification

```bash
bun run test:auto
```

Expected:
- Navigator follows all steps (navigate, click tabs, click search)
- Validator produces PASS/FAIL determination
- Summary shows accurate passed/failed/inconclusive counts
- Reports contain meaningful data
