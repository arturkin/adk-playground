# Playwright Migration — Shaping Notes

## Scope

Replace Puppeteer + Set-of-Mark visual tagging with Playwright + accessibility tree snapshots. Hybrid approach: Navigator agent uses text-based accessibility tree for interaction (no screenshots), Validator agent keeps screenshots for visual assertion verification.

## Decisions

- **Playwright direct library, not MCP**: Use Playwright as a direct dependency, not via the MCP protocol. Simpler integration with existing ADK tool architecture.
- **Accessibility tree as primary interaction model**: Navigator receives YAML accessibility tree with `[ref=xxx]` identifiers instead of annotated screenshots. Dramatically reduces token cost.
- **Private `_snapshotForAI()` API**: Use Playwright's internal API (same as @playwright/mcp) for ref-annotated snapshots. Pin Playwright version to mitigate API instability.
- **Validator keeps screenshots**: Clean screenshots (no markers) for visual assertion evidence. Actually improves validation quality — no marker clutter.
- **Drop visual tagging entirely**: Delete `visual-tagger.ts`. No more red/blue bounding boxes, no `window.aiElementMap`.

## Context

- **Visuals:** None
- **References:** Current Puppeteer implementation in `src/browser/`, Playwright MCP source at `microsoft/playwright-mcp`
- **Product alignment:** Phase 1 complete; this is an infrastructure improvement that reduces token cost and improves interaction reliability

## Standards Applied

- No standards index entries currently apply (no API or database changes)
- AGENTS.md patterns apply: no `any` types, no `as` casts, no code duplication
