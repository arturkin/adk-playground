# Shape: Text Node Highlighting

## Problem

The QA agent can only see **interactive elements** (buttons, links, inputs) because `visual-tagger.ts` only tags those with red bounding boxes. Non-interactive text (headings, labels like "Select dates", paragraphs) is invisible to the agent. This causes test failures when steps reference text labels — the agent can't see or read that text to locate nearby interactive elements.

## Solution

Add text node highlighting as a separate step in the visual tagging pipeline. Tag non-interactive text elements with **blue** bounding boxes and **T-prefixed IDs** (T1, T2, T3). Inject this data into the agent's prompt alongside the existing interactive element list.

## Key Design Decisions

- **Blue color** for text nodes vs red for interactive — visually distinct
- **"T" prefix IDs** (T1, T2, T3) — prevents the LLM from confusing text with clickable elements
- **Separate state key** (`latestTextNodes`) — doesn't break existing code that reads `latest_elements`
- **40-node cap** with priority sorting (headings > labels > other) — prevents token bloat
- **No `aiTextNodeMap`** — text nodes aren't actionable, just informational
- **Distinct CSS class** (`.ai-text-marker`) — allows independent cleanup
- **Must run AFTER `tagElements()`** — needs `window.aiElementMap` for deduplication

## Scope

Only the visual tagging pipeline and agent prompt. No changes to click/type actions or the interactive element flow.
