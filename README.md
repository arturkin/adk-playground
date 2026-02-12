# ADK-QA: AI-Powered QA Automation Agent

ADK-QA is a next-generation QA automation tool built on the Google Agent Development Kit (ADK). It uses a multi-agent architecture and visual element tagging (Set-of-Mark) to perform reliable, selector-free web testing.

## Features

- **Multi-Agent Orchestration**: Sequential flow through Navigator, Validator, and Reporter agents.
- **Selector-Free Interaction**: Uses visual indicators to detect and interact with elements, eliminating brittle CSS/XPath selectors.
- **Self-Correcting**: The AI adapts and retries when interactions fail.
- **Markdown Test Definitions**: Define tests in simple, human-readable Markdown.
- **Regression Detection**: Compares current runs with historical data to surface new bugs.
- **Versatile Viewports**: Support for desktop, mobile, and tablet testing.
- **Bug Reporting**: Generates detailed Markdown and JSON reports.

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
- `NAVIGATOR_MODEL`: LLM for navigation (default: gemini-3-flash-preview).
- `TEST_DIR`: Directory for test discovery (default: ./tests).
- `RUN_HISTORY_DIR`: Where to save run data (default: ./.qa-runs).
