# Shape: Update All Dependencies to Latest Versions

## Problem

All packages are pinned to specific versions. We want to update them to latest releases to get bug fixes, performance improvements, and new features.

## Approach

1. Run `bun update` to update packages within semver range
2. Check `bun outdated` for major version bumps needing explicit updates
3. Fix any breaking changes from updated packages
4. Verify with type-checking and tests

## Constraints

- Must not break existing functionality
- All tests must pass after update
- TypeScript must compile cleanly

## Risk Areas

- `@google/adk` and `@google/genai` — actively developed, API may change
- `puppeteer` — frequent breaking changes between majors
- `commander` — CLI API changes possible
- `eslint` 8.x → 9.x would require flat config migration
