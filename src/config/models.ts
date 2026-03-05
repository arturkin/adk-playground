// NOTE: flash3 requires StreamingMode.NONE in runConfig when tools are enabled.
// ADK streaming + Gemini 3 + tools = empty responses (adk-python Issue #4090).
// Use flash25 as default until this is confirmed fixed in a future ADK release.
export const MODEL_ALIASES = {
  flash20: "gemini-2.0-flash",
  flash25: "gemini-2.5-flash",
  flash3: "gemini-3-flash",
  flash31lite: "gemini-3.1-flash-lite",
  pro25: "gemini-2.5-pro",
} as const;

export function getModelName(alias: string): string {
  return (MODEL_ALIASES as any)[alias] || alias;
}
