# Shape: Migrate Default Models from Gemini 2.5 to Gemini 3 Series

## Problem

`gemini-2.5-flash` is deprecating June 2026. All four agents currently default to this model. We need to migrate defaults to Gemini 3 series before deprecation.

## Solution

- Change default alias from `flash25` to `flash3` in `src/config/index.ts`
- Update Zod schema defaults in `src/config/schema.ts` to match
- Add deprecation comment in `src/config/models.ts` for `flash25`/`pro25`

## Constraints

- Keep `flash25` and `pro25` aliases available for override via env vars
- No breaking changes to the config interface
