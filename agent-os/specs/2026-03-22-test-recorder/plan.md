# Test Recorder — Implementation Plan

## Tasks

### Task 1: Save spec documentation ✓

Create `agent-os/specs/2026-03-22-test-recorder/` with shape.md, plan.md, references.md.

### Task 2: Export shared utilities

**File**: `src/tools/planning.ts`

- Add `export` to `slugify()` function
- Add `export` to `formatTestMarkdown()` function

### Task 3: Create src/recorder/ module

**New files**:

- `src/recorder/codegen.ts` — Playwright codegen subprocess management
- `src/recorder/converter.ts` — LLM conversion from Playwright code to markdown
- `src/recorder/index.ts` — Re-exports

### Task 4: Add record command to src/index.ts

**Changes**: Add `record <url>` command with `--viewport`, `--output-dir`, `--title` options.
Add `readUserInput()` and `handleRecording()` helpers.

## Verification

1. `bun build` — TypeScript compiles without errors
2. `bun src/index.ts record --help` — shows correct usage
3. End-to-end manual test: record session → generates .md test file
4. Generated file passes `parseTestCase()` validation
