# Test Recorder — Shaping Notes

## Scope

Add a `record` CLI command that launches a browser via Playwright codegen, captures user interactions, and generates a test markdown file. The user interacts naturally with the site; after recording stops, an LLM converts the raw Playwright-generated code into our human-readable markdown test format.

## Decisions

- **Recording engine**: Playwright codegen subprocess (`npx playwright codegen`) — it provides a built-in inspector toolbar and is the standard Playwright recording mechanism
- **Session control**: Playwright's built-in recorder toolbar (in-page) + Ctrl+C on CLI; both stop recording and trigger conversion
- **Viewport**: User specifies before recording; one recording produces one file (run twice for both viewports)
- **LLM conversion**: Use `@google/genai` directly (not ADK agent) — single prompt-response task, not a multi-step loop
- **Clarifying questions**: After initial generation, LLM may ask questions about unclear steps; answered via CLI stdin; max 1 round
- **Output format**: Same markdown test format as existing test files (validated by existing `parseTestCase()`)

## Context

- **Visuals**: None
- **References**: `generate` command pattern in `src/index.ts`; `src/tools/planning.ts` for `formatTestMarkdown()`; `src/agents/planner.ts` for LLM usage example
- **Product alignment**: Supports test bootstrapping goal — reduces friction of creating test coverage for large websites

## Standards Applied

- No `any` types, no `as` casts, no underscore prefixes
- CLI patterns: thin action, extracted helpers (`resolveTestSuite`, `printRunSummary` pattern)
- No code duplication — reuse `formatTestMarkdown`, `slugify`, `parseTestCase`
