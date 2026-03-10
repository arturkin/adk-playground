# References for Evaluator Agent

## Similar Implementations

### Validator Agent

- **Location:** `src/agents/validator.ts`
- **Relevance:** Same LlmAgent + single-tool pattern; evaluator mirrors this structure with `recordEvaluationTool` instead of `recordAssertionTool`
- **Key patterns:** `outputKey`, `emptyResponseNudgeCallback` as `afterModelCallback`, `thinkingBudget` from config

### Reporter Agent

- **Location:** `src/agents/reporter.ts`
- **Relevance:** Shows how an agent reads from session state placeholders (`{assertions}`, `{validation_result}`) without needing screenshot injection
- **Key patterns:** No `beforeModelCallback`, no screenshot tools, pure text reasoning

### recordAssertionTool

- **Location:** `src/tools/reporting.ts`
- **Relevance:** Template for `recordEvaluationTool` — same FunctionTool + Zod schema + `toolContext.state.set` pattern

### Orchestrator Phase Pattern

- **Location:** `src/agents/orchestrator.ts`
- **Relevance:** Each phase runs a sub-agent with try/catch and state delta propagation; evaluator follows the same pattern as validator phase
