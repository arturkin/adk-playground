# References for Production Readiness

## Files to Modify

### src/logger.ts

- **Location:** `src/logger.ts`
- **Relevance:** Current minimal logger (verbose flag only) — will be replaced by `src/logger/` module

### src/env.ts

- **Location:** `src/env.ts`
- **Relevance:** Environment variable loading — needs GCP_PROJECT_ID and GCP_SA_KEY additions

### src/index.ts

- **Location:** `src/index.ts`
- **Relevance:** CLI entry point with ~53 console.log calls — highest migration target, also where job summary write goes

### src/tests/runner.ts

- **Location:** `src/tests/runner.ts`
- **Relevance:** Test execution logging (~20 calls) — needs log groups and error annotations

### .github/workflows/qa.yml

- **Location:** `.github/workflows/qa.yml`
- **Relevance:** CI pipeline — needs new secrets, CI=true env var

### package.json

- **Location:** `package.json`
- **Relevance:** Remove unused winston, add @google-cloud/logging

## Additional Files with console.log Usage

- `src/browser/page-actions.ts`
- `src/browser/manager.ts`
- `src/browser/utils.ts`
- `src/tools/helpers.ts`
- `src/agents/callbacks.ts`
- `src/agents/orchestrator.ts`
- `src/memory/test-corrector.ts`
- `src/memory/run-store.ts`
- `src/memory/lesson-store.ts`
- `src/config/index.ts`
- `src/tests/discovery.ts`
