# Playwright Migration — Plan

## Tasks

1. ✓ Save spec documentation
2. ✓ Replace dependencies (puppeteer → playwright v1.58.2)
3. ✓ Update types (`src/types/browser.ts`)
4. ✓ Rewrite BrowserManager (`src/browser/manager.ts`)
5. ✓ Adapt utils (`src/browser/utils.ts`)
6. ✓ Create accessibility module (`src/browser/accessibility.ts`)
7. ✓ Rewrite page actions (`src/browser/page-actions.ts`)
8. ✓ Update browser index (`src/browser/index.ts`)
9. ✓ Rewrite captureBrowserState (`src/tools/helpers.ts`)
10. ✓ Update interaction tools (`src/tools/interaction.ts`)
11. ✓ Update observation tools (`src/tools/observation.ts`)
12. ✓ Rewrite screenshot injection callback (`src/agents/callbacks.ts`)
13. ✓ Rewrite navigator system prompt (`src/agents/navigator.ts`)
14. ✓ Delete visual tagger (`src/browser/visual-tagger.ts`)
15. ✓ Update validator take_screenshot behavior (clean screenshots, no markers)
16. ✓ Build verification (`tsc` — compiles cleanly)
17. ✓ Smoke test (accessibility snapshot + ref resolution verified)

## Verification

- `tsc` compiles without errors
- `HEADLESS=false bun src/index.ts manual "Go to google.com and search for playwright"` works
- `bun src/index.ts auto --test-file tests/flight-search.md` passes end-to-end
