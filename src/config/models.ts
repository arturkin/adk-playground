export const MODEL_ALIASES = {
  flash20: 'gemini-2.0-flash',
  flash25: 'gemini-2.5-flash',
  flash3: 'gemini-3-flash-preview',
  pro25: 'gemini-2.5-pro',
} as const;

export function getModelName(alias: string): string {
  return (MODEL_ALIASES as any)[alias] || alias;
}
