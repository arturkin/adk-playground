# Product Roadmap

## Phase 1: MVP ✅ COMPLETE

- ✅ **Manual QA mode** — Given a page URL and a task description, navigate the page, find interactive elements via visual indicators, and validate that the task/bug has been addressed
- ✅ **Automated QA mode** — Read test definitions from markdown files, run Chrome headless, and execute all described test steps with validation
- ✅ **Run memory** — Compare current test runs against previous runs to detect new bugs and regressions, particularly valuable for automated pipelines
- ✅ **Bug reporting** — Surface found bugs, inconsistencies, and validation failures in clear reports
- ✅ **Versatile testing** — Support mobile and desktop viewports, SEO validation, text/translation checking on pages
- ✅ **Multi-agent architecture** — Self-correcting agent setup with evals and self-checks to maintain quality and eliminate flakiness
- ✅ **Configurable LLM usage** — Token-efficient design with support for multiple LLM providers, configurable per step
- ✅ **3-Level Self-Correction Pipeline**:
  - ✅ Within-run retry strategies with alternative approaches
  - ✅ Cross-run failure learning with lesson injection
  - ✅ Test definition correction suggestions (manual and auto-apply modes)
- ✅ **Model Configuration Tracking** — Records AI model usage per test run for performance analysis and comparison
- ✅ **Knowledge Base System** — Domain-specific context injection for improved test interpretation

## Phase 2: Enhancement & Scale

### Observability & Analytics
- **Results dashboard** — Visual dashboard displaying test results, failure lessons, model performance, and historical trends
- **Lesson analytics** — Visualize failure patterns, resolution rates, and self-correction effectiveness
- **Model performance metrics** — Compare test outcomes across different AI model configurations

### Intelligence & Automation
- **Advanced failure analysis** — LLM-powered failure analysis to complement deterministic categorization
- **Predictive flakiness detection** — Identify tests likely to fail based on historical patterns
- **Auto-healing test suites** — Automatic test maintenance based on accumulated failure lessons

### Integrations & Extensibility
- **Plugin/addon system** — Extensibility layer for custom test types and integrations
- **Asana integration** — Connect test results and bug reports to Asana tasks and projects
- **Auto-fix pipeline** — Integrate with coding tools (Claude Code, Gemini CLI) to automatically fix detected issues, then re-validate the result
- **CI/CD plugins** — Native integrations for GitHub Actions, GitLab CI, Jenkins

### Collaboration Features
- **Lesson sharing** — Export/import failure lessons across teams and projects
- **Test library** — Shared repository of common test patterns and knowledge bases
- **Collaborative debugging** — Team workspace for analyzing and resolving persistent test failures
