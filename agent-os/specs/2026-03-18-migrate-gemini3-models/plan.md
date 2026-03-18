# Plan: Migrate Default Models from Gemini 2.5 to Gemini 3 Series

## Tasks

1. ✓ Create spec documentation (shape.md, plan.md, references.md)
2. ✓ Update `src/config/index.ts` — change default alias from `"flash25"` to `"flash3"` for all four agents
3. ✓ Update `src/config/schema.ts` — change Zod schema defaults from `"gemini-2.5-flash"` to `"gemini-3-flash-preview"`
4. ✓ Add deprecation note in `src/config/models.ts` for `flash25`/`pro25`
5. ✓ Verify: `bunx tsc --noEmit`, `bun test src/`, CLI smoke test
