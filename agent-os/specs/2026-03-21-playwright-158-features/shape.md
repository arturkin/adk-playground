# Adopt Playwright 1.58 Features — Shaping Notes

## Scope

Adopt three new Playwright 1.58 features into ADK-QA:

1. **Incremental snapshots** — use `_snapshotForAI({ track: "response" })` to send only accessibility tree diffs after the first Navigator iteration, reducing token cost
2. **Test generator command** — adapt Playwright's planner agent concept into a `generate` CLI command that explores a URL and produces markdown test files in our native format
3. **CDP connection with isLocal** — add `connectOverCDP()` support to BrowserManager for connecting to existing browser instances with file-system optimizations

## Decisions

- Incremental snapshots are highest priority (token cost reduction on every test run)
- `_snapshotForAI` remains a private API — we continue using it with version pinning
- Playwright's planner agent prompt is adapted for Gemini + our ADK tools (not used as-is with Claude + MCP)
- CDP connection uses `isLocal: true` since ADK-QA always runs co-located with the browser
- No new dependencies required — all features use existing Playwright 1.58 APIs

## Context

- **Visuals:** None
- **References:** Playwright planner agent at `node_modules/playwright/lib/agents/playwright-test-planner.agent.md`, Playwright MCP tab snapshot logic at `node_modules/playwright/lib/mcp/browser/tab.js`
- **Product alignment:** Aligns with roadmap Phase 2 goals of reducing token cost and improving developer experience
