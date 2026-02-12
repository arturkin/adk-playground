# Shape: Fix Click MIME Mismatch

## Scope

One-line fix in `src/agents/callbacks.ts`. No API changes, no new dependencies.

## Decisions

- Fix the MIME type at the declaration site (`callbacks.ts`) rather than changing the capture format (`page-actions.ts`), because JPEG is the correct choice for screenshots (smaller payload, faster uploads to Gemini).
- No abstraction needed — the capture format and MIME declaration are in only two files. A shared constant would be over-engineering for this case.

## Context

- Screenshots are base64-encoded JPEG captured via Playwright's `page.screenshot({ type: "jpeg" })`.
- The `injectScreenshotCallback` sends them to Gemini as inline data blobs. The `mimeType` field must match the actual encoding or the model cannot decode the image.
- This bug made the navigator agent effectively blind, causing all interaction-dependent tests to fail.
