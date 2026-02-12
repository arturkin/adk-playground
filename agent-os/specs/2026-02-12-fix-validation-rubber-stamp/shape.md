# Fix Validation Rubber-Stamp -- Shaping Notes

## Scope

Fix the QA automation tool's validation system which rubber-stamps PASS on all tests regardless of actual outcomes. Build a comprehensive eval framework with negative test scenarios to prove and maintain validation correctness.

## Decisions

- **Production-ready quality** -- Not a quick fix; thorough solution with structural safeguards
- **Multi-signal status determination** -- Combine validation_result text, recorded assertions, and bug severity to determine pass/fail
- **Structural safeguard** -- Tests with serious bugs (critical/high/medium) automatically FAIL regardless of what the LLM says
- **Anti-rubber-stamp prompting** -- Validator requires visible evidence for each assertion, biases toward FAIL when in doubt
- **Validator gets screenshot access** -- Add `injectScreenshotCallback` so validator can actually see the page state
- **Assertion list injection** -- Pass `testCase.assertions` to session state so validator knows exactly what to check
- **Multiple negative test types** -- Wrong URL, impossible elements, wrong content, impossible result counts
- **Eval framework compares expected vs actual** -- Not just "did tests pass" but "did the RIGHT tests pass and the RIGHT tests fail"

## Context

- **Visuals:** None
- **References:** Extensive code study across `src/agents/`, `src/tests/`, `src/evals/`, `src/tools/`, `src/types/`, `src/reports/`
- **Product alignment:** Directly impacts core value proposition per `agent-os/product/mission.md` -- "AI-powered QA agent" requires reliable verdicts. False passes undermine trust in the tool.
- **Standards:** None defined yet (`agent-os/standards/index.yml` is empty)

## Root Cause Analysis

### RC1: Validator never receives the assertion list
`src/tests/runner.ts:27-36` creates session state with `task_steps`, `url_hint`, `expected_criteria`, `current_viewport` but NOT `testCase.assertions`. The validator has no specific criteria to check against.

### RC2: Validator instruction is vague
`src/agents/validator.ts:9-18` says "Check if the page state matches the expected outcome" with no hard rules for PASS vs FAIL. The LLM defaults to optimistic (PASS).

### RC3: Validator can't see the page
`src/agents/validator.ts` is missing `beforeModelCallback: injectScreenshotCallback`. The navigator has it, but the validator validates against text description only, not actual page state.

### RC4: No structural safeguard against bugs + PASS
`src/tests/runner.ts:86-98` can produce `status: 'passed'` even when bugs with medium/high severity were recorded by the reporter. Proven by Search Tour test run: found a "date picker not interactive" bug (medium severity) but status was "passed".

### RC5: `validation_result` propagation is fragile
ADK's `outputKey` mechanism (`maybeSaveOutputToState`) only fires when `isFinalResponse(event)` is true (zero function calls in the event). If the validator's last message is a tool call, `validation_result` never gets saved. The orchestrator's `Object.assign(ctx.session.state, event.actions.stateDelta)` is a mitigation but doesn't guarantee capture.

### RC6: No way to measure validation accuracy
No negative test scenarios exist. No eval framework compares expected outcomes. Can't tell if fixes actually work without known-FAIL test cases.