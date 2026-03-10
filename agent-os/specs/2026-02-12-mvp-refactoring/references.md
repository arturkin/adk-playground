# References for MVP Refactoring

## Current Codebase

### Agent Loop (`src/agent/index.ts` — 315 lines)

- **Location**: `src/agent/index.ts`
- **Relevance**: Contains the entire QA agent flow, system prompt, tool definitions, and 20-iteration loop that must be decomposed into the multi-agent architecture
- **Key patterns**: System prompt (lines 158-188), manual loop (lines 196-306), tool execution (lines 234-262), screenshot injection (lines 270-296)

### Browser Module (`src/browser/index.ts` — 266 lines)

- **Location**: `src/browser/index.ts`
- **Relevance**: Set-of-Mark visual tagging system and all Puppeteer interactions — core innovation, must be preserved
- **Key patterns**: `tagElements` (lines 56-218), smart label positioning (3-mode), element map storage, `target="_blank"` prevention

### Gemini Adapter (`src/googleGenai.ts` — 183 lines)

- **Location**: `src/googleGenai.ts`
- **Relevance**: Documents exact message format conversion between Genkit and Google GenAI API — helps verify ADK handles same patterns natively
- **Status**: Will be deleted (ADK handles model communication internally)

### Evaluation System (`src/evals.ts` — 169 lines)

- **Location**: `src/evals.ts`
- **Relevance**: Contains 2 test cases (search car, search tour) and LLM-based evaluation logic that will become the first markdown test files and eval framework
- **Key patterns**: `evaluateResult` function (lines 62-92), test case format (lines 12-60)

### Memory Module (`src/memory/index.ts` — 78 lines)

- **Location**: `src/memory/index.ts`
- **Relevance**: Simple JSON file persistence pattern — will be replaced with run-store for test results
- **Status**: Will be replaced

## Google ADK Documentation

### Getting Started

- https://google.github.io/adk-docs/get-started/typescript/
- Installation: `npm install @google/adk`
- Agent definition: `new LlmAgent({ name, model, instruction, tools })`
- Tool definition: `new FunctionTool({ name, description, parameters, execute })`

### Multi-Agent Patterns

- Sequential: https://google.github.io/adk-docs/agents/workflow-agents/sequential-agents/
- Loop: https://google.github.io/adk-docs/agents/workflow-agents/loop-agents/
- Custom: https://google.github.io/adk-docs/agents/custom-agents/
- LoopAgent terminates via `toolContext.actions.escalate = true`
- Data flows via `outputKey` and `{variable}` interpolation in instructions

### State Management

- https://google.github.io/adk-docs/sessions/state/
- Prefixes: `temp:` (invocation-scoped), `user:` (user-scoped), `app:` (global)
- Access via `context.state.get()` / `context.state.set()`

### Callbacks

- https://google.github.io/adk-docs/callbacks/types-of-callbacks/
- `beforeModelCallback({ context, request })` — can modify LLM request
- `afterAgentCallback(context)` — runs after agent completes

### GitHub Repository

- https://github.com/google/adk-js
