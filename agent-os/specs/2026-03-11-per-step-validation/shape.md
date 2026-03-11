# Per-Step Validation

## Problem

All assertions currently run at the end of a test after all navigation steps complete. The validator takes a single final screenshot and evaluates all assertions against it. This means:

- Failures are detected late — you don't know which step caused the issue
- Assertions only see the final page state, missing transient states
- Evidence quality is poor when the page has changed since the relevant step

## Solution

Allow test steps to have their own assertions, validated during navigation using screenshots the navigator already captures. No extra LLM calls — the navigator checks step assertions as part of its normal flow.

## Key Decisions

1. **Hybrid assertion model**: Steps can optionally have explicit assertions; steps without assertions are not validated per-step
2. **Keep both**: Per-step validations AND final test-level assertions at the end
3. **No separate agent**: Navigator validates step assertions itself using existing screenshots (no extra LLM calls)
4. **Markdown syntax**: Indented checkbox assertions under step lines (`- [ ] ...`)

## Scope

- Extend `TestStep` type with optional `assertions`
- Update parser for indented step assertions
- Add `StepAssertionResult` to report types
- Create `record_step_assertion` tool
- Update navigator to validate step assertions
- Update runner status logic
- Update reporter and evaluator context
