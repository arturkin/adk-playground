# Plan: Dependency Update + Gemini 3 Flash Fix

**Date:** 2026-03-05
**Priority:** URGENT (gemini-3-flash-preview shuts down March 9, 2026)

## Tasks

### Task 1: Safe Package Bumps

- `@google/adk`: ^0.3.0 → ^0.4.0
- `@google/genai`: ^1.41.0 → ^1.43.0
- `@google/adk-devtools`: ^0.3.0 → ^0.4.0
- `glob`: ^13.0.2 → ^13.0.6
- `@typescript-eslint/eslint-plugin`: ^8.55.0 → ^8.56.1
- `@typescript-eslint/parser`: ^8.55.0 → ^8.56.1
- ESLint stays at v8 (no flat config migration)

### Task 2: Puppeteer v22 → v24

- Remove `@types/puppeteer` (v24 ships own types)
- Verify browser files type-check

### Task 3: Fix Gemini 3 Flash

- `gemini-3-flash-preview` → `gemini-3-flash` (stable ID)
- Add `flash31lite: 'gemini-3.1-flash-lite'`
- Investigate ADK streaming issue with Gemini 3 + tools

### Task 4: Verification

- `bun run build` → 0
- `bun run lint` → 0
- `bun run test:auto` → same pass rate
