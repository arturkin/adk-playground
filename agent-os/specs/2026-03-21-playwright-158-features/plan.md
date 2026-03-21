# Playwright 1.58 Feature Adoption — Plan

## Task 1: Save spec documentation ✓

## Task 2: Incremental snapshots
- [ ] 2.1 Update `src/browser/accessibility.ts` — interface, snapshot options, resetSnapshotTracking
- [ ] 2.2 Update `src/browser/index.ts` — forward incremental option
- [ ] 2.3 Update `src/tools/helpers.ts` — use incremental mode after step 0
- [ ] 2.4 Update `src/agents/callbacks.ts` — label diffs vs full trees
- [ ] 2.5 Update `src/agents/navigator.ts` — prompt section for incremental diffs
- [ ] 2.6 Update `src/browser/manager.ts` — reset tracking in close()

## Task 3: Test generator command
- [ ] 3.1 Create `src/tools/planning.ts` — save_test_plan tool
- [ ] 3.2 Create `src/agents/planner.ts` — planner LlmAgent
- [ ] 3.3 Update `src/tools/index.ts` — export planning tools
- [ ] 3.4 Update `src/agents/index.ts` — export planner
- [ ] 3.5 Add `generate` command in `src/index.ts`

## Task 4: CDP connection with isLocal
- [ ] 4.1 Update `src/config/schema.ts` — cdpEndpoint field
- [ ] 4.2 Update `src/browser/manager.ts` — connectCDP method
- [ ] 4.3 Update `src/browser/index.ts` — convenience wrapper
- [ ] 4.4 Update `src/index.ts` — --cdp CLI option

## Task 5: Verify build compiles cleanly

## Verification
- Run `bun src/index.ts auto --test flight-search` for incremental snapshots
- Run `bun src/index.ts generate <url>` for test generator
- Typecheck with `bunx tsc --noEmit`
