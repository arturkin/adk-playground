# Per-Step Validation — Plan

## Tasks

1. ✓ Save spec documentation
2. ✓ Extend TestStep type — `src/types/test.ts`
3. ✓ Update parser for per-step assertions — `src/tests/parser.ts`
4. ✓ Add StepAssertionResult to report types — `src/types/report.ts`
5. ✓ Create recordStepAssertionTool — `src/tools/reporting.ts`
6. ✓ Export new tool (auto-exported via barrel) — `src/tools/index.ts`
7. ✓ Update navigator — `src/agents/navigator.ts`
8. ✓ Update runner — `src/tests/runner.ts`
9. ✓ Update reporter — `src/agents/reporter.ts`
10. ✓ Update evaluator — `src/agents/evaluator.ts`
11. ✓ Verify build — `bunx tsc --noEmit` passes

## Verification

1. ✓ `bunx tsc --noEmit` — no type errors
2. Backward compatibility — existing tests without per-step assertions work (step_assertions stays empty)
3. Per-step test — add assertions to steps and run to verify navigator calls tool
