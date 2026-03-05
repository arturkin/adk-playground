// Model availability (Google AI API v1beta, as of 2026-03-05):
//   flash20, flash25, pro25 — stable GA, work with tools
//   flash31lite             — preview, works with tools (gemini-3.1-flash-lite-preview)
//   flash3                  — GA model ID does NOT exist in v1beta yet; 404s silently.
//                             Will be updated when Google makes it available.
export const MODEL_ALIASES = {
  flash20: "gemini-2.0-flash",
  flash25: "gemini-2.5-flash",
  flash3: "gemini-3-flash",            // NOT YET AVAILABLE — use flash25 or flash31lite
  flash31lite: "gemini-3.1-flash-lite-preview",
  pro25: "gemini-2.5-pro",
} as const;

export function getModelName(alias: string): string {
  return (MODEL_ALIASES as any)[alias] || alias;
}
