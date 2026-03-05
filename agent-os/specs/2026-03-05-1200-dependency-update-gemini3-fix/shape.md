# Shape: Dependency Update + Gemini 3 Flash Fix

## Files Modified

| File                             | Change                                                |
| -------------------------------- | ----------------------------------------------------- |
| `package.json`                   | Version bumps, remove @types/puppeteer, puppeteer v24 |
| `src/config/models.ts`           | Fix flash3 alias, add flash31lite                     |
| `agent-os/product/tech-stack.md` | Update model list                                     |

## Model Aliases (post-fix)

```typescript
export const MODEL_ALIASES = {
  flash20: "gemini-2.0-flash",
  flash25: "gemini-2.5-flash",
  flash3: "gemini-3-flash",
  flash31lite: "gemini-3.1-flash-lite",
  pro25: "gemini-2.5-pro",
} as const;
```

## Streaming Issue

ADK streaming + Gemini 3 + tools = empty responses (Issue #4090 adk-python, affects adk-js).

- Try ADK 0.4.0 first — may be patched
- If not: add streaming disable config to LlmAgent constructors for Gemini 3 models
- `.env` default stays `flash25` if Gemini 3 still broken
