# ADK-QA: AI-Powered QA Automation Agent

ADK-QA is a next-generation QA automation tool built on the Google Agent Development Kit (ADK). It uses a multi-agent architecture and Playwright's accessibility tree to perform reliable, selector-free web testing — no CSS or XPath selectors required.

## Features

- **Multi-Agent Orchestration**: Sequential pipeline through Navigator, Validator, Evaluator, and Reporter agents.
- **Selector-Free Interaction**: Uses Playwright's accessibility tree with `[ref]` identifiers to interact with elements — no brittle CSS/XPath selectors.
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
2.  **Navigator**: LoopAgent that interacts with the browser via accessibility tree snapshots to complete test steps.
3.  **Validator**: Assesses outcomes against expected criteria using clean screenshots and records assertions.
4.  **Evaluator**: Post-validation LLM pass that reviews the validator's assertions and flags suspicious PASS verdicts (confidence-based override).
5.  **Reporter**: Compiles findings into a structured report and identifies bugs.

## Tech Stack

- **Runtime**: TypeScript on Bun
- **AI/LLM**: Google Gemini 3.x (flash, flash-lite, pro variants)
- **Agent Framework**: Google Agent Development Kit (ADK)
- **Browser Automation**: Playwright (Chromium) with accessibility tree interaction
- **CLI**: Commander.js
- **Validation**: Zod v4

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

# Run tests matching a name (partial, case-insensitive)
bun start auto --test "flight"

# Auto-apply test definition corrections (after 3+ consecutive failures)
bun start auto --auto-fix
```

### Parallel Execution

Run multiple tests concurrently using subprocess workers — each test gets its own isolated browser:

```bash
# Run all tests with 3 in parallel
bun start auto --concurrency 3

# Combine with other options
bun start auto --concurrency 2 --auto-fix
```

Each worker's logs are captured and replayed as a contiguous block once the test completes, so output is never interleaved regardless of concurrency.

### Sharding

Run only a partition of the test suite — useful for splitting work across machines or CI jobs:

```bash
# Run the first third of tests
bun start auto --shard 1/3

# Run the second third
bun start auto --shard 2/3

# Combine with concurrency
bun start auto --shard 1/2 --concurrency 3
```

Shards are contiguous chunks: `--shard 1/3` runs tests `[0..ceil(N/3)]`, `--shard 2/3` runs the next chunk, and so on.

### Discover and Merge (CI helpers)

```bash
# List all test file paths as JSON (used by CI matrix)
bun run test:discover

# Produce N shard specs for a CI matrix (e.g. ["1/3","2/3","3/3"])
bun run test:discover -- --shards 3

# Merge per-shard JSON results into a single report
bun run test:merge -- --results-dir artifacts/shard-inputs
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
- `NAVIGATOR_MODEL`: LLM for navigation (default: gemini-3-flash, aliases: `flash`, `flash-lite`, `pro`, `thinking`).
- `VALIDATOR_MODEL`: LLM for validation (default: gemini-3-flash).
- `REPORTER_MODEL`: LLM for reporting (default: gemini-3-flash).
- `EVALUATOR_MODEL`: LLM for evaluation (default: gemini-3-flash).

All runtime artifacts (reports, run history, lessons) are written to `artifacts/` (gitignored). Directory paths and other constants are defined in `src/constants.ts`.

## CI Pipeline

The GitHub Actions workflow (`.github/workflows/qa.yml`) runs in three stages:

1. **Discover** — scans the `tests/` directory and builds a matrix of shard specs (e.g. `["1/3","2/3","3/3"]`)
2. **Test (matrix)** — each shard job runs its subset with `--concurrency 3`, uploading result JSON as an artifact
3. **Merge** — downloads all shard artifacts, merges them into a single `TestRunResult`, generates the final report and writes the GitHub step summary

This means all tests run in parallel across jobs, and within each job up to 3 tests run concurrently.

## GitHub Actions Secrets

The CI pipeline uses the following secrets. Configure them in your repository's Settings > Secrets and variables > Actions.

| Secret                 | Purpose                                        | Required                                 |
| ---------------------- | ---------------------------------------------- | ---------------------------------------- |
| `GOOGLE_GENAI_API_KEY` | Gemini API access for LLM agents               | Yes                                      |
| `GCP_PROJECT_ID`       | GCP project for Cloud Logging                  | No                                       |
| `GCP_SA_KEY`           | Service account key for Cloud Logging (base64) | No (required if `GCP_PROJECT_ID` is set) |

### Setting up GCP Cloud Logging (optional)

To send structured logs to Google Cloud Logging:

1. Create a service account with the `roles/logging.logWriter` role
2. Export the JSON key file
3. Base64-encode it: `base64 -i sa-key.json | tr -d '\n'`
4. Add the encoded string as the `GCP_SA_KEY` secret
5. Add your GCP project ID as the `GCP_PROJECT_ID` secret

Logs appear in GCP Cloud Logging under the `adk-qa` log name with labels for branch, commit, and run ID.

## Self-Correction System

ADK-QA includes a 3-level self-correction pipeline that learns from failures:

### Level 1: Within-Run Retry

When the navigator encounters errors during a test run, it applies intelligent retry strategies:

- Element removed/changed → Take fresh accessibility snapshot to get updated element refs
- Click intercepted → Dismiss overlays/popups first, then retry
- Element not in list → Scroll to reveal it
- Same approach failed 3+ times → Try alternative strategies (keyboard navigation, different elements)

### Level 2: Cross-Run Learning

Failure lessons are stored in `artifacts/lessons/lessons.json` and automatically injected into future test runs:

- Each failure is analyzed and categorized (navigation_error, element_not_found, timing_issue, popup_overlay, assertion_mismatch, test_definition_issue)
- Actionable advice is generated for each failure type
- Up to 3 most recent lessons are injected into navigator and validator prompts
- When a test passes, previous lessons are marked as resolved

### Level 3: Test Definition Corrections

After 3+ consecutive failures of the same type, the system suggests corrections:

- Assertion mismatches → Suggests updating assertion expectations
- Test definition issues → Suggests clarifying test steps
- Navigation errors → Suggests verifying the target URL

Corrections are logged to console and saved to `artifacts/lessons/corrections.json`. Use `--auto-fix` to automatically apply corrections (with `.bak` backups).

### Viewing Self-Correction Data

- **Active lessons**: Displayed at the end of each test run
- **Correction suggestions**: Shown in console output and Markdown reports
- **Model configuration**: Tracked in test results for comparing model performance
