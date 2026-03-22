# Evaluator Agent

## Context

The validator agent records pass/fail assertions for each test, but lighter models (e.g. `gemini-3.1-flash-lite-preview`) can rubber-stamp results — passing all assertions with identical boilerplate evidence, or writing "PASS" despite contradictory evidence text. The `recordAssertionTool` already catches structural contradictions via string matching, but subtler patterns slip through.

The `EVALUATOR_MODEL` config slot exists and is tracked in reports but is currently unused. This feature gives it a real job: a second LLM pass that reviews the validator's recorded assertions for quality and can override PASS → FAIL when rubber-stamping is detected. It never overrides FAIL → PASS (only tightens, never loosens).

## Approach

Add an evaluator agent that runs as **Phase 2.5** between the validator and reporter. It:

1. Reads the recorded assertions from session state (`assertions` JSON + `validation_result` text)
2. Calls a single tool `record_evaluation` with a confidence score (0–100) and an optional `override: "FAIL"` + reason
3. The runner reads `evaluation_result` from session state and applies the override to the final status decision

**Rubber-stamp patterns the evaluator LLM detects:**

- All assertions passed with generic/boilerplate evidence ("the page shows the expected content")
- Evidence text is nearly identical across all assertions
- Evidence contradicts the passed=true verdict (subtle cases string matching misses)
- All passed when navigation_result indicates problems
- The validator's final word ("PASS"/"FAIL") conflicts with the assertion results

The evaluator has no tools except `record_evaluation` and no screenshot access — it's a pure text reasoning pass over structured data already in session state.

## Files

### New files

- `src/agents/evaluator.ts` — `buildEvaluatorAgent(config)`
- (tool added to existing `src/tools/reporting.ts`)

### Modified files

- `src/tools/reporting.ts` — add `recordEvaluationTool`
- `src/agents/orchestrator.ts` — add evaluator as Phase 2.5, register in `subAgents`
- `src/agents/index.ts` — export `buildEvaluatorAgent`
- `src/config/schema.ts` — add `evaluator` to `thinkingBudgets` (default: 1000)
- `src/types/report.ts` — add optional `evaluationResult` to `TestCaseResult`
- `src/tests/runner.ts` — read `evaluation_result` from session state; apply override to status decision
- `src/reports/formatter.ts` — show evaluator confidence/override in report

## Task 1: Save spec documentation

Create `agent-os/specs/2026-03-05-evaluator-agent/` with:

- `plan.md` — this plan
- `shape.md` — shaping notes
- `references.md` — reference implementations

## Task 2: Add `recordEvaluationTool` to `src/tools/reporting.ts`

```typescript
// Schema
const evaluationParamsSchema = z.object({
  confidence: z
    .number()
    .min(0)
    .max(100)
    .describe("Confidence 0–100 that the validator's verdict is correct"),
  override: z
    .enum(["FAIL"])
    .nullable()
    .describe("Set to 'FAIL' to override a PASS verdict; null to accept"),
  reason: z
    .string()
    .describe("Explanation of confidence score and override rationale"),
});

export const recordEvaluationTool = new FunctionTool({
  name: "record_evaluation",
  description:
    "Records the evaluator's confidence score and optional verdict override.",
  parameters: evaluationParamsSchema as any,
  execute: async ({ confidence, override, reason }: any, toolContext) => {
    toolContext.state.set(
      "evaluation_result",
      JSON.stringify({ confidence, override, reason }),
    );
    return {
      status: "success",
      message: `Evaluation recorded: confidence=${confidence}, override=${override ?? "none"}`,
    };
  },
});
```

Export from `src/tools/index.ts`.

## Task 3: Create `src/agents/evaluator.ts`

```typescript
import { LlmAgent } from "@google/adk";
import { type AppConfig } from "../config/schema.js";
import { recordEvaluationTool } from "../tools/index.js";
import { emptyResponseNudgeCallback } from "./callbacks.js";

export function buildEvaluatorAgent(config: AppConfig) {
  return new LlmAgent({
    name: "evaluator",
    model: config.models.evaluator,
    instruction: `You are a QA evaluation auditor. Your ONLY job is to assess whether the validator recorded honest, evidence-backed assertions or rubber-stamped the results.

ASSERTIONS RECORDED BY VALIDATOR:
{assertions}

VALIDATOR VERDICT:
{validation_result}

ORIGINAL ASSERTIONS TO EVALUATE:
{test_assertions}

NAVIGATION SUMMARY (for context):
{navigation_result}

RUBBER-STAMP WARNING SIGNS — flag these with low confidence or an override:
- All assertions passed with generic evidence ("page shows expected content", "element is visible")
- Evidence text is nearly identical across multiple assertions
- Evidence text contains absence language ("not found", "missing") but passed=true
- Validator said PASS but navigation_result describes errors or incomplete steps
- All assertions passed for a complex 5+ assertion test with no failures at all

YOUR TASK:
1. Review each assertion's evidence against its description.
2. Call record_evaluation ONCE with:
   - confidence: 0–100 (how confident you are the validator's verdict is correct)
     - 90–100: strong independent evidence for each assertion
     - 70–89: mostly good but some evidence is vague
     - 50–69: evidence is generic or partially contradictory
     - 0–49: clear rubber-stamping or contradictions detected
   - override: "FAIL" if confidence < 50 AND the current verdict is PASS, otherwise null
   - reason: one sentence explaining your assessment

You MUST call record_evaluation exactly once. Do NOT write analysis before calling it.`,
    tools: [recordEvaluationTool],
    outputKey: "evaluator_output",
    generateContentConfig: {
      thinkingConfig: { thinkingBudget: config.thinkingBudgets.evaluator },
    },
    afterModelCallback: emptyResponseNudgeCallback,
  });
}
```

## Task 4: Wire evaluator into `src/agents/orchestrator.ts`

Add Phase 2.5 between validator and reporter:

```typescript
import { buildEvaluatorAgent } from "./evaluator.js";
// ...
private evaluator;

constructor(config: AppConfig) {
  // ...
  const evaluator = buildEvaluatorAgent(config);
  super({ name: "orchestrator", subAgents: [navigatorLoop, validator, evaluator, reporter] });
  this.evaluator = evaluator;
}

// In runAsyncImpl, after validator phase:
// Phase 2.5: Evaluate validator output
try {
  for await (const event of this.evaluator.runAsync(ctx)) {
    if (event.actions?.stateDelta) {
      Object.assign(ctx.session.state, event.actions.stateDelta);
    }
    yield event;
  }
} catch (e) {
  console.warn(`  [Evaluator error: ${(e as Error).message}] -- continuing`);
}
```

## Task 5: Add `evaluator` thinking budget to `src/config/schema.ts`

```typescript
thinkingBudgets: z.object({
  navigator: z.number().default(8000),
  validator: z.number().default(2000),
  reporter: z.number().default(0),
  evaluator: z.number().default(1000),  // add this
}).default({}),
```

Also add `EVALUATOR_THINKING_BUDGET` env var handling in `src/config/index.ts` (same pattern as others).

## Task 6: Apply evaluator override in `src/tests/runner.ts`

After reading session state, read `evaluation_result`:

```typescript
const evaluationJson =
  (sessionDetails?.state?.["evaluation_result"] as string) || "";
const evaluation = evaluationJson ? JSON.parse(evaluationJson) : null;
```

Add to status decision logic (before existing checks):

```typescript
// Signal 5: evaluator override
if (evaluation?.override === "FAIL" && status !== "failed") {
  status = "failed";
  statusReason = `Evaluator override (confidence: ${evaluation.confidence}): ${evaluation.reason}`;
}
// Also downgrade PASS → inconclusive when confidence is low but no explicit override
if (evaluation && evaluation.confidence < 50 && status === "passed") {
  status = "inconclusive";
  statusReason = `Low evaluator confidence (${evaluation.confidence}/100): ${evaluation.reason}`;
}
```

Add `evaluationResult` to the `TestCaseResult` object:

```typescript
evaluationResult: evaluation ? { confidence: evaluation.confidence, override: evaluation.override, reason: evaluation.reason } : undefined,
```

## Task 7: Update types and formatter

**`src/types/report.ts`** — add to `TestCaseResult`:

```typescript
evaluationResult?: { confidence: number; override: string | null; reason: string };
```

**`src/reports/formatter.ts`** — add evaluator row to per-test section (after assertions table):

```
**Evaluator**: confidence=85/100 — "Evidence is specific and matches page content"
```

Or when override: `**Evaluator**: ⚠ OVERRIDE FAIL (confidence=35/100) — "All assertions have identical boilerplate evidence"`

## Verification

1. Run `bun run test:auto` — evaluator phase appears in logs as `[Agent: evaluator]`
2. Use a model known to rubber-stamp (e.g. `gemini-3.1-flash-lite-preview`) for validator, stronger model for evaluator
3. Check that `evaluation_result` appears in session state after the evaluator runs
4. Verify reports include the confidence score
5. To test override: set validator model to a weak one and evaluator to a strong one; confirm that a rubber-stamped PASS gets overridden to FAIL
