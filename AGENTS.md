# Agent OS: Spec-Driven Development

This repository follows the **Agent OS** approach, utilizing structured development cycles driven by detailed specifications. All agents (human or AI) interacting with this repository MUST follow this methodology.

## Repository Structure (agent-os)

High-level context and development history are maintained in the `agent-os/` directory:

- **`agent-os/product/`**: The "Source of Truth" for the product vision.
  - `mission.md`: Core purpose and values.
  - `tech-stack.md`: Approved technologies and architectures.
  - `roadmap.md`: Planned phases and features.
- **`agent-os/standards/`**: Architectural and coding guidelines.
  - `index.yml`: Entry point for standards.
- **`agent-os/specs/`**: Feature-specific development artifacts. Each feature/refactor has its own date-prefixed folder (e.g., `2026-02-12-mvp-refactoring/`) containing:
  - `shape.md`: High-level scope, architectural decisions, and constraints.
  - `plan.md`: A detailed, task-by-task execution plan with verification steps.
  - `references.md`: Pointers to relevant source code, documentation, or external assets.

## Spec-Driven Development (SDD) Workflow

To maintain high quality and traceability, every significant change follows this automated workflow:

### 1. Exploration & Context Gathering

- Read `agent-os/product/` to understand the goal.
- Read `agent-os/standards/` to ensure compliance.
- Search `agent-os/specs/` for historical context or conflicting plans.

### 2. Shaping (The "What" and "Why")

- Create a new spec directory: `agent-os/specs/YYYY-MM-DD-short-description/`.
- Create `shape.md` to define the scope and key technical decisions.

### 3. Planning (The "How")

- Create `plan.md` with a numbered list of tasks.
- Each task MUST have a clear goal, specific files to modify/create, and a verification method.
- Create `references.md` with links to all files that will be touched.

### 4. Incremental Execution

- Implement tasks one by one.
- Update `plan.md` after each step:
  - Mark completed tasks with `✓`.
  - Mark in-progress tasks with `*`.
  - Mark failed tasks with `!`.
- **Never skip verification.**

### 5. Final Verification

- Run the full verification suite defined at the end of `plan.md`.
- Ensure all tests pass and the build is clean.

## CLI Code Patterns

When implementing CLI command handlers (Commander.js actions), keep actions thin:

- **Extract selection logic**: Multi-branch input resolution (e.g., "which test suite to run?") belongs in a named function like `resolveTestSuite(options)`, not inline in `.action()`.
- **Extract output logic**: Console-heavy summary/reporting blocks belong in named functions like `printRunSummary(...)`, not scattered through action handlers.
- **Extract repeated guards**: API key checks and similar guards used in multiple commands belong in a helper like `requireApiKey()`.
- **Keep actions as orchestration**: An `.action()` handler should read like a high-level script — call helpers, not contain implementation.

This keeps `index.ts` readable top-to-bottom and makes each concern independently testable.

## Best Practices

- **No `any` types**: Never use `any` in TypeScript. Use specific types, generics, or interface augmentation (e.g., `Window & { myProp: string }`) instead.
- **No `as` casts**: Avoid type assertions with `as`. Narrow types through guards, generics, or proper interface definitions.
- **No underscore-prefixed names**: Do not use `_` prefixes for variables, parameters, or filenames (e.g., use `helpers.ts` not `_helpers.ts`, use a named parameter not `_unused`).
- **VERY IMPORTANT — No code duplication**: Whenever you write or modify code, actively look for copy-pasted logic across functions, files, or modules and extract it into shared helpers. Duplicated code is a bug magnet — a fix in one copy is silently missed in others. Extract shared logic immediately rather than deferring it.

## Instructions for Automated Agents

When you are initialized in this repository:

1.  **Check for Active Specs**: Scan `agent-os/specs/` for the latest `plan.md` that hasn't been fully completed (look for items without `✓`).
2.  **Continue the Work**: If an active plan exists, resume from the first incomplete task.
3.  **Create Specs for New Tasks**: If you are given a new objective, start by creating the `agent-os/specs/` artifacts (Shape, Plan, References) BEFORE modifying any code.
4.  **Stay within the Box**: Follow the boundaries defined in `shape.md`. If you need to change the approach, update the `shape.md` first.
5.  **Documentation is Code**: Treat `agent-os/` files with the same rigor as source code. They are your memory and your instructions.
