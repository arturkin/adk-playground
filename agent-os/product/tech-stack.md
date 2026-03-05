# Tech Stack

## Language & Runtime

- **TypeScript** — Primary language
- **Bun** — Runtime and package manager

## AI / LLM

- **Google Gemini** — Primary LLM provider
  - `gemini-2.5-flash` (default) — fast, cost-efficient
  - `gemini-3-flash` — latest generation (streaming+tools fix pending ADK issue #4090)
  - `gemini-3.1-flash-lite` — cost-optimised, released 2026-03-03
  - `gemini-2.5-pro` — highest capability
- **Google Agent Development Kit (ADK)** — Multi-agent orchestration framework
- Configurable to support additional LLM providers per step

## Cloud & Infrastructure

- **Google Cloud Platform (GCP)** — Cloud hosting and services
- **GitHub Actions** — CI/CD for automated QA runs

## Browser Automation

- **Chrome / Chrome Headless** — Target browser for both manual and automated modes
- Visual element injection for selector-free interaction
