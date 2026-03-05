# Product Mission

## Problem

Web QA is broken. Manual QA is slow and inconsistent, while automated QA tools (TestCafe, Cypress, Playwright) rely on brittle CSS/XPath selectors that break with every UI change, producing flaky tests that erode trust. Teams waste time maintaining fragile test suites instead of shipping quality software.

## Target Users

QA engineers, developers, and engineering teams who need reliable web application testing — both for manual validation and automated CI/CD pipelines. Built to serve a broad audience beyond a single team.

## Solution

An AI-powered QA agent that uses injected visual indicators to detect and interact with page elements — no selectors required. The tool is self-correcting: when an interaction fails, the AI adapts and retries rather than breaking the entire test run. It operates in two modes:

- **Manual QA mode**: Point it at a page with a task, and it validates the work — bug fixes, acceptance criteria, translations, SEO, and more.
- **Automated QA mode**: Runs headless in CI (GitHub Actions), executing test suites defined in markdown files.

Key differentiators:

- **No selectors** — visual element detection eliminates the primary source of test flakiness
- **3-level self-correction** — learns from failures within runs, across runs, and suggests test improvements
  - Level 1: Within-run retry strategies with alternative approaches
  - Level 2: Cross-run learning that injects failure insights into future tests
  - Level 3: Automatic test definition correction suggestions after repeated failures
- **Model performance tracking** — records which AI models were used for each test run, enabling systematic evaluation and optimization
- **Continuous learning** — builds a knowledge base of failure patterns and resolutions, improving reliability over time
- **Versatile** — desktop, mobile, SEO, translations, regression detection, all in one tool
