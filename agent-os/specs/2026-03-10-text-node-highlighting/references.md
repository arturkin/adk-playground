# References

## Source Files Modified

- `src/types/browser.ts` — Added `TextNodeMetadata` interface
- `src/browser/visual-tagger.ts` — Added `tagTextNodes()`, updated `clearMarkers()`
- `src/browser/index.ts` — Added `tagTextNodes` wrapper
- `src/tools/_helpers.ts` — Calls `tagTextNodes` in `captureBrowserState()`
- `src/tools/observation.ts` — Calls `tagTextNodes` in `take_screenshot` tool
- `src/agents/callbacks.ts` — Injects `latest_text_nodes` into LLM prompt
- `src/agents/navigator.ts` — Updated instruction to explain T-prefixed text elements
- `AGENTS.md` — Added best practices: no `any`, no underscore names

## Related Specs

- `agent-os/specs/2026-02-12-mvp-refactoring/` — Original visual tagging pipeline
