# Parallel Test Runs — Shaping Notes

## Scope

Add two levels of parallelism to adk-qa:

1. **In-process**: Run multiple test cases concurrently within a single process using subprocess workers (`--concurrency <n>`)
2. **CI matrix**: Split tests across multiple GitHub Actions jobs (`--shard <i>/<n>`), then merge results

## Decisions

- **Subprocess workers over in-process threads**: `BrowserManager` is a deep singleton used by every ADK tool. `accessibility.ts` has module-level snapshot state. `lessonStore`/`runStore` use file-based read-modify-write. Subprocesses give free isolation — each worker gets its own singletons with zero refactoring.
- **Log isolation via stderr buffering**: Workers redirect all logger output to stderr (detected via `ADK_QA_WORKER=true` env var). Parent buffers each worker's stderr and prints it as a contiguous block when the worker completes — no interleaved output.
- **Lesson recording moves to parent**: Workers skip writing lessons (they'd race on `lessons.json`). The parent processes lessons sequentially after all workers finish.
- **CI concurrency default**: 3 parallel tests per shard, balancing API rate limits and memory.
- **Shard partitioning**: Chunked (not round-robin). Shard `i/n` runs `tests[chunk_i_start..chunk_i_end]`.

## Context

- **Visuals**: None
- **References**: `src/tests/runner.ts`, `src/browser/manager.ts`, `src/logger/transports/console.ts`, `.github/workflows/qa.yml`
- **Product alignment**: Phase 2 roadmap — "CI/CD plugins — Native integrations for GitHub Actions"

## Standards Applied

None defined in agent-os/standards/ yet.
