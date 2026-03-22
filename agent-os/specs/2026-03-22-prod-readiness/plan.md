# Production Readiness — Plan

## Task 1: Save spec documentation ✓

Create `agent-os/specs/2026-03-22-prod-readiness/` with shape.md, plan.md, references.md.

## Task 2: Create logger module with types and core class ✓

**Create** `src/logger/types.ts` — LogLevel, LogEntry, LogTransport interfaces.
**Create** `src/logger/logger.ts` — Core Logger class with debug/info/warn/error methods, group() for collapsible sections, transport array.

## Task 3: Console transport (local dev) ✓

**Create** `src/logger/transports/console.ts` — Human-readable colored output matching current ANSI color look.

## Task 4: CI transport (GitHub Actions) ✓

**Create** `src/logger/transports/ci.ts` — JSON lines, ::group::/::endgroup::, ::error::/::warning:: annotations.

## Task 5: GCP Cloud Logging transport ✓

**Create** `src/logger/transports/gcp.ts` — Uses GCP Cloud Logging REST API directly via fetch() (no @google-cloud/logging dependency needed). Base64-decoded SA key auth with JWT token exchange. Graceful no-op when unconfigured.

## Task 6: Logger factory and index ✓

**Create** `src/logger/index.ts` — Transport selection by env vars. Singleton log export. Delete old src/logger.ts.

## Task 7: Add GCP env vars and update dependencies ✓

**Modify** src/env.ts, .env.example, package.json (remove winston — GCP transport uses native fetch, no extra deps needed).

## Task 8: Replace all console.log/error/warn with logger ✓

**Modify** 14 source files to use new log.info/warn/error/debug API. All ANSI color codes removed.

## Task 9: Add log grouping and annotations to test runner ✓

**Modify** src/tests/runner.ts — log.group() per test, error/warning annotations with testId context.

## Task 10: GH Actions job summary ✓

**Modify** src/index.ts — Write markdown report to $GITHUB_STEP_SUMMARY when available.

## Task 11: Update workflow YAML ✓

**Modify** .github/workflows/qa.yml — Add GCP secrets to env, add CI=true. Fixed artifact paths to match actual directories (artifacts/runs, artifacts/reports, artifacts/lessons).

## Task 12: Update README with secrets inventory ✓

**Modify** README.md — Document all GH Actions secrets with GCP Cloud Logging setup instructions.

## Verification

1. ✓ `bun run build` — Zero compilation errors
2. Local smoke: colored readable output
3. CI mode: JSON lines + ::group:: markers with CI=true
4. GCP: Cloud Logging entries when credentials set
5. GH Actions: Collapsible groups, job summary, error annotations
