# ADK-QA: AI-Powered QA Automation Agent

ADK-QA is a next-generation QA automation tool built on the Google Agent Development Kit (ADK). It uses a multi-agent architecture and visual element tagging (Set-of-Mark) to perform reliable, selector-free web testing.

## Features

- **Multi-Agent Orchestration**: Sequential flow through Navigator, Validator, and Reporter agents.
- **Selector-Free Interaction**: Uses visual indicators to detect and interact with elements, eliminating brittle CSS/XPath selectors.
- **3-Level Self-Correction Pipeline**:
  - **Level 1 (Within-Run)**: Enhanced retry strategies with alternative approaches when failures occur
  - **Level 2 (Cross-Run)**: Learns from past failures and injects insights into future test runs
  - **Level 3 (Test Definition)**: Suggests corrections to test definitions after repeated failures
- **Markdown Test Definitions**: Define tests in simple, human-readable Markdown.
- **Regression Detection**: Compares current runs with historical data to surface new bugs.
- **Model Configuration Tracking**: Records which AI models were used for each test run, enabling model performance comparisons.
- **Versatile Viewports**: Support for desktop, mobile, and tablet testing.
- **Bug Reporting**: Generates detailed Markdown and JSON reports with correction suggestions.

## Architecture

1.  **Orchestrator**: Deterministic agent that manages the overall flow.
2.  **Navigator**: LoopAgent that interacts with the browser to complete test steps.
3.  **Validator**: Assesses outcomes against expected criteria and records assertions.
4.  **Reporter**: Compiles findings into a structured report and identifies bugs.

## Setup

1.  **Install Dependencies**:

    ```bash
    bun install
    ```

2.  **Configure Environment**:

    ```bash
    cp .env.example .env
    # Edit .env and add your GOOGLE_GENAI_API_KEY
    ```

3.  **Build the Project**:
    ```bash
    bun run build
    ```

## Usage

### Manual QA Mode

Run a one-off task with natural language:

```bash
bun start manual "Go to http://guidetoiceland.is and check the title"
```

### Automated QA Mode

Run test suites defined in `.md` files:

```bash
# Run all tests in the default tests directory
bun run test:auto

# Run a specific test file
bun start auto --test-file ./tests/search-car-rental.md

# Auto-apply test definition corrections (after 3+ consecutive failures)
bun start auto --auto-fix
```

### Evaluation Mode

Run evaluation benchmarks:

```bash
bun run eval
```

## Writing Tests

Tests are defined in Markdown files in the `tests/` directory:

```markdown
# My Test Case

## Metadata

- **url**: https://example.com
- **viewport**: desktop
- **priority**: high

## Steps

1. Navigate to home
2. Click 'Login'

## Expected Outcome

Login modal is visible.

## Assertions

- [ ] Modal is displayed
```

## Configuration

Configuration is managed via environment variables and validated with Zod. See `src/config/schema.ts` for all options.

- `GOOGLE_GENAI_API_KEY`: Your Gemini API key.
- `HEADLESS`: Set to `false` to see the browser in action.
- `NAVIGATOR_MODEL`: LLM for navigation (default: gemini-2.5-flash, alias: `flash25`, `pro25`).
- `VALIDATOR_MODEL`: LLM for validation (default: gemini-2.5-flash).
- `REPORTER_MODEL`: LLM for reporting (default: gemini-2.5-flash).
- `EVALUATOR_MODEL`: LLM for evaluation (default: gemini-2.5-flash).
- `TEST_DIR`: Directory for test discovery (default: ./tests).
- `RUN_HISTORY_DIR`: Where to save run data (default: ./.qa-runs).
- `LESSONS_DIR`: Where to save failure lessons (default: ./.qa-lessons).
- `KNOWLEDGE_BASE_DIR`: Directory for domain-specific context (default: ./knowledge-base).

## Self-Correction System

ADK-QA includes a 3-level self-correction pipeline that learns from failures:

### Level 1: Within-Run Retry

When the navigator encounters errors during a test run, it applies intelligent retry strategies:

- Element removed/changed → Take fresh screenshot to get updated element IDs
- Click intercepted → Dismiss overlays/popups first, then retry
- Element not in list → Scroll to reveal it
- Same approach failed 3+ times → Try alternative strategies (keyboard navigation, different elements)

### Level 2: Cross-Run Learning

Failure lessons are stored in `.qa-lessons/lessons.json` and automatically injected into future test runs:

- Each failure is analyzed and categorized (navigation_error, element_not_found, timing_issue, popup_overlay, assertion_mismatch, test_definition_issue)
- Actionable advice is generated for each failure type
- Up to 3 most recent lessons are injected into navigator and validator prompts
- When a test passes, previous lessons are marked as resolved

### Level 3: Test Definition Corrections

After 3+ consecutive failures of the same type, the system suggests corrections:

- Assertion mismatches → Suggests updating assertion expectations
- Test definition issues → Suggests clarifying test steps
- Navigation errors → Suggests verifying the target URL

Corrections are logged to console and saved to `.qa-lessons/corrections.json`. Use `--auto-fix` to automatically apply corrections (with `.bak` backups).

### Viewing Self-Correction Data

- **Active lessons**: Displayed at the end of each test run
- **Correction suggestions**: Shown in console output and Markdown reports
- **Model configuration**: Tracked in test results for comparing model performance
