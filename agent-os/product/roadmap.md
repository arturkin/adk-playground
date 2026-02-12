# Product Roadmap

## Phase 1: MVP

- **Manual QA mode** — Given a page URL and a task description, navigate the page, find interactive elements via visual indicators, and validate that the task/bug has been addressed
- **Automated QA mode** — Read test definitions from markdown files, run Chrome headless, and execute all described test steps with validation
- **Run memory** — Compare current test runs against previous runs to detect new bugs and regressions, particularly valuable for automated pipelines
- **Bug reporting** — Surface found bugs, inconsistencies, and validation failures in clear reports
- **Versatile testing** — Support mobile and desktop viewports, SEO validation, text/translation checking on pages
- **Multi-agent architecture** — Self-correcting agent setup with evals and self-checks to maintain quality and eliminate flakiness
- **Configurable LLM usage** — Token-efficient design with support for multiple LLM providers, configurable per step

## Phase 2: Post-Launch

- **Results dashboard** — Visual dashboard displaying test results, memory status, current/historical runs
- **Plugin/addon system** — Extensibility layer for custom test types and integrations
- **Asana integration** — Connect test results and bug reports to Asana tasks and projects
- **Auto-fix pipeline** — Integrate with coding tools (Claude Code, Gemini CLI) to automatically fix detected issues, then re-validate the result
