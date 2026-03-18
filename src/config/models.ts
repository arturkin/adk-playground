// Model availability (Google AI API, as of 2026-03-18):
//   flash20, flash25, pro25 — stable GA (gemini-2.5 deprecating June 2026)
//   flash3, flash31lite, pro31 — Gemini 3 series (preview)
//   NOTE: gemini-3-pro-preview was shut down 2026-03-09; use pro31 instead.
export const MODEL_ALIASES = {
  flash20: "gemini-2.0-flash",
  flash25: "gemini-2.5-flash",
  pro25: "gemini-2.5-pro",
  flash3: "gemini-3-flash-preview",
  flash31lite: "gemini-3.1-flash-lite-preview",
  pro31: "gemini-3.1-pro-preview",
} as const;

export function getModelName(alias: string): string {
  return (MODEL_ALIASES as any)[alias] || alias;
}
