# References

## Files to Modify

- `src/types/test.ts` — TestStep type
- `src/types/report.ts` — StepAssertionResult, TestCaseResult
- `src/tests/parser.ts` — Parse indented assertions under steps
- `src/tools/reporting.ts` — recordStepAssertionTool + shared safeguard helper
- `src/tools/index.ts` — Export new tool
- `src/agents/navigator.ts` — Add tool + instruction update
- `src/tests/runner.ts` — Format step assertions, read results, status logic
- `src/agents/reporter.ts` — Include step assertions in report
- `src/agents/evaluator.ts` — Include step assertions in evaluation
