# Evaluator Agent — Shaping Notes

## Scope

A post-validation LLM pass that reviews the validator's recorded assertions for rubber-stamping and flags suspicious PASS verdicts. Can override PASS → FAIL when confidence < 50. Never overrides FAIL → PASS.

## Decisions

- Single tool (`record_evaluation`) with confidence (0–100), optional override ("FAIL" | null), and reason
- Runs as Phase 2.5: after validator, before reporter
- No screenshot access — pure text review of session state data
- Confidence < 50 with current verdict PASS → override to FAIL; confidence < 50 without override → inconclusive
- `EVALUATOR_THINKING_BUDGET` defaults to 1000 tokens (lighter than validator's 2000)

## Context

- **Visuals:** None
- **References:** `src/agents/validator.ts` — same LlmAgent + FunctionTool pattern
- **Product alignment:** Aligns with "Multi-agent architecture — self-correcting agent setup with evals and self-checks"

## Standards Applied

- None from agent-os/standards (index.yml has no entries matching this feature)
