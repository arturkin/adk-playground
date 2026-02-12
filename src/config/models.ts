export const MODEL_ALIASES = {
  flash: 'gemini-3-flash-preview',
  pro: 'gemini-3-pro',
  thinking: 'gemini-2.5-flash-thinking',
} as const;

export function getModelName(alias: string): string {
  return (MODEL_ALIASES as any)[alias] || alias;
}
