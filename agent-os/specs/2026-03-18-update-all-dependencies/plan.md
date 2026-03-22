# Plan: Update All Dependencies to Latest Versions

## Tasks

### Task 1: Save Spec Documentation ✓

Create spec directory with shape.md, plan.md, references.md.

### Task 2: Update All Dependencies ✓

- Run `bun outdated` to review what will change
- Run `bun update` to update within semver range
- Run `bun add <pkg>@latest` for any major version bumps

### Task 3: Fix Breaking Changes ✓

- `@google/adk` 0.4→0.5: `ToolContext` and `CallbackContext` → `Context`
- `zod` 3→4: `.default({})` on nested objects needs explicit defaults

### Task 4: Run Tests ✓

- 8 tests pass, 0 fail

### Task 5: Final Verification ✓

- `bunx tsc --noEmit` — clean
- `bun test` — 8/8 pass
- `bun run build` — clean

### Skipped (major risk / migration required)

- `eslint` 8→10: requires flat config migration (breaking)
- `commander` 14→(no update needed, already at latest patch)
- `prettier`, `ts-node`: kept at current (no updates available)
