# Model Config Improvements + Self-Correction Pipeline -- Shaping Notes

## Scope

Two interconnected capabilities for the ADK-QA system:

1. **Model Configuration Traceability** -- Record which Gemini models are used per agent role (navigator, validator, reporter, evaluator) in test run results and reports. Enables comparing run outcomes across different model configurations.

2. **3-Level Self-Correction Pipeline** -- Enable the system to learn from failures across runs without human intervention:
   - **Level 1 (Within-Run):** Enhanced retry strategies in navigator instructions so the LLM tries alternative approaches before giving up.
   - **Level 2 (Cross-Run):** Failure lessons stored on disk and injected into agent prompts on subsequent runs, providing context about what went wrong before.
   - **Level 3 (Test Correction):** After repeated consecutive failures (3+), suggest or auto-apply corrections to test definitions.

## Decisions

- **Model config is optional on `TestRunResult`** -- Backward-compatible with existing stored `.qa-runs/` JSON files. Old runs simply won't have the field.
- **`pro25` alias added** -- Maps to `gemini-2.5-pro`. The existing `pro` alias already maps to the same model but `pro25` makes it explicit and consistent with `flash25`.
- **Deterministic failure analyzer only** -- No LLM calls for failure categorization or advice generation. Uses pattern matching on error strings, assertion evidence, and validation output. This keeps analysis fast, predictable, and zero-cost.
- **First run = no change** -- Empty lessons produce empty strings in template variables, resulting in identical behavior to today's system. No special-casing needed.
- **Max 3 lessons injected per test** -- Prevents prompt bloat while providing relevant recent context. Most recent lessons take priority.
- **Lessons keyed by testId (file path)** -- Test rename = new identity; old lessons become orphaned (harmless, can be garbage-collected later).
- **File-based persistence** -- Lessons stored at `.qa-lessons/lessons.json`, corrections at `.qa-lessons/corrections.json`. Follows the same pattern as `.qa-runs/` for run history.
- **Suggest-only by default** -- Test definition corrections are logged to console and reports but not applied unless `--auto-fix` flag is passed. When auto-fix is used, `.bak` backups are created.
- **Retry strategies are prompt-only** -- Level 1 improvements require no code changes beyond navigator instruction text. The LoopAgent already supports iteration and the LLM receives full conversation history within the loop.

## Constraints

- All new features must be additive -- existing test runs and reports must continue to work without modification.
- No new LLM calls beyond what already exists -- failure analysis is deterministic.
- Lesson injection must not exceed a reasonable prompt budget (~500 tokens for 3 lessons).
- The `--auto-fix` flag must never modify test files without creating backups.

## Context

- **Product alignment:** Directly supports the mission of reliable AI-powered QA automation. Model traceability enables systematic evaluation of which models work best for each role. Self-correction reduces manual intervention when tests fail due to transient issues or outdated test definitions.
- **Standards:** Follows Agent OS methodology for spec-driven development. Uses existing patterns (RunStore, config schema, template variables) for consistency.
- **Prior art:** The knowledge base injection system (`{knowledge_base}` template variable, `src/tests/discovery.ts`) demonstrates the pattern for injecting context into agent prompts. The lesson injection system follows the same approach.
