# Bug Fix: Agent Fails to Click — MIME Type Mismatch

## Context

Feature tests are failing because the navigator agent never clicks or interacts with elements on the page. The root cause is a **MIME type mismatch** in the screenshot injection callback: screenshots are captured as **JPEG** (`page-actions.ts` line 74: `type: "jpeg"`) but declared as **PNG** (`callbacks.ts` line 25: `mimeType: 'image/png'`) when sent to the Gemini API.

The `@google/genai` SDK documents `Blob.mimeType` as "Required. The IANA standard MIME type of the source data." Sending JPEG data with a PNG MIME type causes Gemini to fail to process the image, leaving the agent blind to the page state and unable to identify which elements to click.

## Task 1: Save Spec Documentation

Create `agent-os/specs/2026-02-12-fix-click-mime-mismatch/` with:

- **plan.md** — This full plan
- **shape.md** — Shaping notes (scope, decisions, context)
- **references.md** — Pointers to the files involved

## Task 2: Fix MIME Type Mismatch

### File: `src/agents/callbacks.ts` (line 25)

Change `mimeType: 'image/png'` → `mimeType: 'image/jpeg'`

## Task 3: Verify

Run `bun run test:auto` and confirm:
- Navigator agent takes actions (clicks, types)
- Tests reach pass/fail verdicts instead of inconclusive/error
