# References

## Files Involved

- `src/browser/page-actions.ts` — `getScreenshot()` captures JPEG at line 74
- `src/agents/callbacks.ts` — `injectScreenshotCallback` declares MIME type at line 25

## External Docs

- `@google/genai` SDK: `Blob.mimeType` — "Required. The IANA standard MIME type of the source data."
