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
- **AI-driven self-correction** — recovers from failures instead of producing false negatives
- **Versatile** — desktop, mobile, SEO, translations, regression detection, all in one tool
