# Plan: Text Node Highlighting

## Tasks

1. ✓ Create spec documentation (`shape.md`, `plan.md`, `references.md`)
2. ✓ Add `TextNodeMetadata` type to `src/types/browser.ts`
3. ✓ Add `tagTextNodes()` function and update `clearMarkers()` in `src/browser/visual-tagger.ts`
4. ✓ Add `tagTextNodes` wrapper in `src/browser/index.ts`
5. ✓ Call `tagTextNodes` in `captureBrowserState()` in `src/tools/_helpers.ts`
6. ✓ Call `tagTextNodes` in `take_screenshot` tool in `src/tools/observation.ts`
7. ✓ Inject `latest_text_nodes` into LLM prompt in `src/agents/callbacks.ts`
8. ✓ Update navigator instruction in `src/agents/navigator.ts`
9. ✓ Clean up `tests/filter-tour-dates.md` (was already clean)
10. ✓ Add coding best practices to `AGENTS.md`

## Verification

- [x] `bun run build` — no TypeScript errors
- [ ] Manual test: `bun run start auto --test-file tests/filter-tour-dates.md` with `HEADLESS=false`
  - Red boxes around interactive elements (unchanged)
  - Blue boxes around text labels like "Select dates", headings
  - Agent can reference text labels in its reasoning
