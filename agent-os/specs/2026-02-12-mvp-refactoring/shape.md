# MVP Refactoring — Shaping Notes

## Scope

Refactor the entire adk-playground project from a Genkit-based single-agent prototype to a production-ready multi-agent QA automation tool built on Google ADK. The refactoring must meet all MVP requirements from the product roadmap while keeping the project runnable at each step (incremental approach).

## Decisions

- **Framework**: Migrate from Google Genkit to Google ADK (`@google/adk`) — ADK provides multi-agent orchestration (SequentialAgent, LoopAgent, BaseAgent), session/state management, and tool context out of the box
- **Approach**: Incremental refactoring, not a clean rewrite — lower risk, easier to review
- **LLM providers**: Gemini only for now, but design the config system to be extensible (model aliases, per-agent model config)
- **Agent architecture**: Custom BaseAgent orchestrator (deterministic) → LlmAgent navigator (in LoopAgent) → LlmAgent validator → LlmAgent reporter
- **Screenshot injection**: Use `beforeModelCallback` to inject screenshots from `temp:` state into model requests, replicating the current manual loop behavior
- **Loop termination**: Use `toolContext.actions.escalate = true` via a `taskCompleted` tool instead of string-matching "TASK COMPLETED"
- **Test definitions**: Markdown files with structured sections (Metadata, Steps, Expected Outcome, Assertions)
- **ESM migration**: Required by ADK — switch from CommonJS to ESM

## Context

- **Visuals**: None provided
- **References**: Current codebase (`src/agent/index.ts`, `src/browser/index.ts`) — the Set-of-Mark visual tagging system and Puppeteer browser automation are preserved
- **Product alignment**: Addresses all Phase 1 MVP items from `agent-os/product/roadmap.md`; architecture is designed to support Phase 2 items (dashboard, plugins, Asana, auto-fix)

## Standards Applied

- No formal standards defined yet (`agent-os/standards/index.yml` is empty)
- ADK patterns follow official Google ADK documentation
