# Parallel Test Runs — Execution Plan

## Tasks

1. ✓ **Save spec documentation** — Create this spec folder
2. ✓ **Extract lesson recording** — `src/tests/runner.ts`: extract `recordTestLessons()`, skip in worker mode
3. ✓ **Add worker mode to logger** — `src/logger/transports/console.ts`: redirect to stderr when `ADK_QA_WORKER=true`
4. ✓ **Create worker entry point** — `src/tests/worker.ts`: runs single test, outputs JSON to stdout
5. ✓ **Add `runTestSuiteParallel`** — `src/tests/runner.ts`: subprocess pool, log buffering, result aggregation
6. ✓ **Add CLI options** — `src/index.ts`: `--concurrency <n>` and `--shard <i>/<n>`
7. ✓ **Create CI helper scripts** — `src/tests/discover-cli.ts` and `src/tests/merge-results.ts`
8. ✓ **Update CI workflow** — `.github/workflows/qa.yml`: 3-job pipeline (discover → test matrix → merge)
9. ✓ **Add package.json scripts** — `test:discover`, `test:merge`

## Verification

- `bun run test:auto` still works (concurrency=1 default, no behavior change)
- `bun src/index.ts auto --concurrency 2` runs two tests concurrently with clean grouped output
- `bun src/index.ts auto --shard 1/2` runs first half of tests
- Lessons recorded correctly after parallel run (`artifacts/lessons/`)
- CI YAML validates (`act` or manual run)
