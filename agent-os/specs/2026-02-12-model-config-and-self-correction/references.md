# Model Config Improvements + Self-Correction Pipeline -- References

## Impacted Files

### Model Configuration (Task 1)
- **`src/config/models.ts`**: Add `pro25` alias to `MODEL_ALIASES`.
- **`src/types/report.ts`**: Add `ModelConfig` interface, extend `TestRunResult`.
- **`src/tests/runner.ts`**: Capture `config.models` into `TestRunResult.modelConfig`.
- **`src/reports/formatter.ts`**: Render model config section in Markdown reports.
- **`src/index.ts`**: Print model config at start of auto run.

### Failure Lessons (Tasks 2-4)
- **`src/config/schema.ts`**: Add `lessonsDir` field to `ConfigSchema`.
- **`src/config/index.ts`**: Map `LESSONS_DIR` env var.
- **`src/types/index.ts`**: Re-export `lessons.ts`.
- **`src/memory/index.ts`**: Re-export `lesson-store.ts`, `failure-analyzer.ts`, `lesson-formatter.ts`.
- **`src/tests/runner.ts`**: Lesson lookup, injection into session state, recording after execution.
- **`src/agents/navigator.ts`**: Add `{failure_lessons}` template variable to instruction.
- **`src/agents/validator.ts`**: Add `{validator_failure_context}` template variable to instruction.

### Test Correction (Task 6)
- **`src/tests/runner.ts`**: Invoke `TestCorrectionManager` after failures.
- **`src/index.ts`**: Add `--auto-fix` CLI flag, pass as `RunOptions.autoFix`.
- **`src/reports/formatter.ts`**: Render corrections section in Markdown reports.

## New Files

### Types
- **`src/types/lessons.ts`**: `FailureLesson` and `TestCorrection` interfaces.

### Memory / Persistence
- **`src/memory/lesson-store.ts`**: `LessonStore` class -- file-based persistence for failure lessons.
- **`src/memory/failure-analyzer.ts`**: Deterministic failure categorization and advice generation.
- **`src/memory/lesson-formatter.ts`**: Format lessons into injectable prompt context strings.
- **`src/memory/test-corrector.ts`**: `TestCorrectionManager` for Level 3 corrections.

### Runtime Artifacts
- **`.qa-lessons/lessons.json`**: Persisted failure lessons (created at runtime).
- **`.qa-lessons/corrections.json`**: Persisted correction suggestions (created at runtime).

## Existing Patterns to Follow

- **`src/memory/run-store.ts`**: Reference implementation for file-based persistence with JSON storage, `ensureDir`, and a singleton export pattern.
- **`src/tests/discovery.ts` (`loadKnowledgeBase`)**: Reference for loading content from disk and injecting it into agent prompts via session state template variables.
- **`src/config/schema.ts` + `src/config/index.ts`**: Reference for adding new config fields with Zod defaults and env var mapping.
- **`src/agents/navigator.ts` (`{knowledge_base}`)**: Reference for template variable injection in agent instructions.
