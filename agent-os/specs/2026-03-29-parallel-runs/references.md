# References

## Files Modified

- `src/tests/runner.ts` — core execution; extract `recordTestLessons`, add `runTestSuiteParallel`
- `src/logger/transports/console.ts` — stderr redirect in worker mode
- `src/index.ts` — CLI entry point for `--concurrency` and `--shard`
- `.github/workflows/qa.yml` — CI pipeline
- `package.json` — new scripts

## Files Created

- `src/tests/worker.ts` — subprocess entry point
- `src/tests/discover-cli.ts` — test discovery for CI matrix
- `src/tests/merge-results.ts` — shard result merging

## Key Architectural Files (Read-Only)

- `src/browser/manager.ts` — singleton BrowserManager (reason for subprocess approach)
- `src/browser/accessibility.ts` — module-level snapshot state
- `src/memory/lesson-store.ts` — file-based lessons (race condition risk)
- `src/memory/run-store.ts` — run history persistence
- `src/reports/index.ts` — report formatting and writing
