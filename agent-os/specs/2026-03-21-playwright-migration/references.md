# References for Playwright Migration

## Current Implementation

### Browser Layer

- **Location:** `src/browser/`
- **Key files:** `manager.ts`, `page-actions.ts`, `visual-tagger.ts`, `utils.ts`, `index.ts`
- **Pattern:** Puppeteer singleton, coordinate-based clicking via `window.aiElementMap`

### Tool Layer

- **Location:** `src/tools/`
- **Key files:** `helpers.ts` (captureBrowserState), `interaction.ts` (click/type/hover tools), `observation.ts` (screenshot/element list)
- **Pattern:** ADK FunctionTool with Zod schemas, tools call browser layer wrappers

### Agent Layer

- **Location:** `src/agents/`
- **Key files:** `callbacks.ts` (injectScreenshotCallback), `navigator.ts` (system prompt), `validator.ts`
- **Pattern:** LlmAgent with beforeModelCallback injecting context

## External References

### Playwright MCP Source

- **Location:** `github.com/microsoft/playwright-mcp`
- **Relevance:** Uses `_snapshotForAI()` and `aria-ref=` selector — same approach we'll adopt
- **Key patterns:** Snapshot capture, ref resolution to Locator

### Playwright ariaSnapshot API

- **Docs:** `playwright.dev/docs/aria-snapshots`
- **Relevance:** Public API returns YAML without refs; private `_snapshotForAI()` adds refs
- **Key patterns:** YAML format with roles, names, attributes
