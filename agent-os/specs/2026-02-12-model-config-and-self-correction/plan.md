# Model Config Improvements + Self-Correction Pipeline -- Execution Plan

## Task 1: Model Configuration Improvements

### 1a. Add `pro25` alias
**File: `src/config/models.ts`**
- Add `pro25: 'gemini-2.5-pro'` to `MODEL_ALIASES`

### 1b. Track model config in test results
**File: `src/types/report.ts`**
- Add `ModelConfig` interface: `{ navigator, validator, reporter, evaluator: string }`
- Add optional `modelConfig?: ModelConfig` to `TestRunResult`

### 1c. Record model config in runner
**File: `src/tests/runner.ts`**
- In `runTestSuite()`, capture `config.models` into the returned `TestRunResult.modelConfig`

### 1d. Display in reports
**File: `src/reports/formatter.ts`**
- Add model config section to `formatMarkdownReport()` (after git commit line)

### 1e. Display in CLI
**File: `src/index.ts`**
- Print model config at start of auto run: `Models: navigator=X, validator=Y, reporter=Z`

---

## Task 2: Failure Lesson Types + Store

Foundation for cross-run learning (Level 2).

### 2a. New types
**New file: `src/types/lessons.ts`**
```typescript
interface FailureLesson {
  testId: string;
  runId: string;
  timestamp: string;
  failureReason: string;            // one-line summary
  failureCategory: 'navigation_error' | 'element_not_found' | 'timing_issue' |
    'popup_overlay' | 'assertion_mismatch' | 'test_definition_issue' | 'unknown';
  analysis: string;                 // what happened
  advice: string;                   // what to try differently
  failedStep?: number;
  consecutiveFailures: number;
  resolved: boolean;                // true when test later passes
}
```

### 2b. LessonStore class
**New file: `src/memory/lesson-store.ts`**
- File-based persistence at `.qa-lessons/lessons.json`
- Pattern: follow existing `RunStore` (`src/memory/run-store.ts`)
- Methods: `getActiveLessons(testId)`, `getConsecutiveFailureCount(testId)`, `addLesson()`, `markResolved(testId)`, `getAllLessons()`

### 2c. Config
**Files: `src/config/schema.ts`, `src/config/index.ts`**
- Add `lessonsDir: z.string().default('./.qa-lessons')` to schema
- Load `LESSONS_DIR` env var

### 2d. Re-exports
**Files: `src/types/index.ts`, `src/memory/index.ts`**
- Re-export new modules

---

## Task 3: Failure Analysis Engine

Deterministic pattern-matching analyzer (no LLM). Fast and predictable.

**New file: `src/memory/failure-analyzer.ts`**
- `analyzeFailure(result: TestCaseResult, runId: string, prevConsecutiveCount: number): FailureLesson`
- `categorizeFailure(result)` -- pattern matches on error strings, assertion evidence, validation output
- `buildAdvice(result, category)` -- generates concrete retry advice per failure category

Categories and their advice:
| Category | Advice |
|----------|--------|
| `navigation_error` | Check tool names, ensure steps complete |
| `element_not_found` | Wait longer, scroll, try alternative selectors |
| `timing_issue` | Wait for page render, look for loading indicators |
| `popup_overlay` | Dismiss overlays/cookies first |
| `assertion_mismatch` | Review specific assertions and evidence |

---

## Task 4: Context Injection (Cross-Run Learning)

### 4a. Lesson formatter
**New file: `src/memory/lesson-formatter.ts`**
- `formatLessonsForNavigator(lessons: FailureLesson[]): string` -- formats up to 3 most recent lessons as injectable prompt context. Returns `''` if no lessons (first run).
- `formatLessonsForValidator(lessons: FailureLesson[]): string` -- shorter context for validator awareness.

### 4b. Inject into session state
**File: `src/tests/runner.ts`**
- Before session creation, look up active lessons via `lessonStore.getActiveLessons(testCase.id)`
- Format with `formatLessonsForNavigator/Validator`
- Add `failure_lessons` and `validator_failure_context` to session state

### 4c. Agent instruction templates
**File: `src/agents/navigator.ts`**
- Append `{failure_lessons}` at end of instruction (empty string on first run = no-op)

**File: `src/agents/validator.ts`**
- Append `{validator_failure_context}` at end of instruction

### 4d. Record lessons after execution
**File: `src/tests/runner.ts`**
- After status determination:
  - If `failed`/`error`: call `analyzeFailure()`, store via `lessonStore.addLesson()`
  - If `passed`: call `lessonStore.markResolved(testId)` to clear previous lessons

---

## Task 5: Enhanced Within-Run Retry (Level 1)

**File: `src/agents/navigator.ts`**
- Add explicit RETRY STRATEGIES section to instruction:
  - Element removed -> take fresh screenshot for new IDs
  - Click intercepted -> look for overlays/popups, dismiss first
  - Element not in list -> scroll to reveal
  - 3 retries of same approach failed -> try alternative (keyboard nav, different element)
  - Can't proceed -> call `task_completed` with failure explanation (never silently skip)

No code changes beyond instruction text -- the LoopAgent already supports iteration and the LLM receives full conversation history within the loop.

---

## Task 6: Test Definition Correction (Level 3)

### 6a. Correction types
**File: `src/types/lessons.ts` (extend)**
```typescript
interface TestCorrection {
  testId: string;
  filePath: string;
  timestamp: string;
  correctionType: 'update_assertion' | 'update_step' | 'update_expected_outcome' | 'update_url';
  description: string;
  section: 'assertions' | 'steps' | 'expected_outcome' | 'metadata';
  originalContent: string;
  suggestedContent: string;
  applied: boolean;
}
```

### 6b. TestCorrectionManager
**New file: `src/memory/test-corrector.ts`**
- Threshold: 3 consecutive failures before suggesting corrections
- `analyzeForCorrections(testCase, lessons): TestCorrection[]`
  - Same assertion failing 3+ times -> suggest assertion update
  - `test_definition_issue` category 3+ times -> suggest step update
- `applyCorrection(correction)` -- creates `.bak` backup, replaces section in test file
- `getPendingCorrections(testId)` -- returns unapplied suggestions
- Stores corrections at `.qa-lessons/corrections.json`

### 6c. Integration
**File: `src/tests/runner.ts`**
- After recording failure lesson, call `testCorrectionManager.analyzeForCorrections()`
- Log suggestions to console (yellow)

### 6d. CLI flag
**File: `src/index.ts`**
- Add `--auto-fix` option to `auto` command (default: false)
- Pass through as `RunOptions.autoFix`
- Default behavior: suggest-only (log to console + report)
- With `--auto-fix`: auto-apply corrections with `.bak` backup

**File: `src/tests/runner.ts`**
- Add `RunOptions` interface: `{ autoFix?: boolean }`
- Update `runTestSuite` signature to accept options

---

## Task 7: Report + CLI Output Enhancements

### 7a. Corrections in reports
**File: `src/reports/formatter.ts`**
- Add optional "Test Definition Corrections" section to Markdown report
- List each suggestion with type, description, and applied status

### 7b. Lesson summary in CLI
**File: `src/index.ts`**
- After regression report, print active lesson count: `Active failure lessons: N (will be injected into next run)`

---

## Verification

1. **Build**: `bun run build` -- TypeScript compiles without errors
2. **First run** (no history): `bun run test:auto` -- identical behavior to today, model config now in reports
3. **After failure**: Run again -- check console for `[Self-Correction]` messages, verify lessons appear in `.qa-lessons/lessons.json`
4. **Lesson injection**: On second+ run after failure, verify navigator prompt includes "PREVIOUS FAILURE INSIGHTS" section
5. **Recovery**: After a previously-failing test passes, verify lessons are marked `resolved: true`
6. **Correction threshold**: After 3+ consecutive failures of same test, verify correction suggestions in console
7. **Auto-fix**: `bun run test:auto -- --auto-fix` -- verify `.bak` backups created and corrections applied
8. **Reports**: Check `reports/report_*.md` includes model config section and any correction suggestions
