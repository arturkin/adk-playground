# Tech Stack

## Language & Runtime

- **TypeScript** — Primary language
- **Bun** — Runtime and package manager

## AI / LLM

- **Google Gemini 3.x** — Primary LLM provider
  - `gemini-3-flash-preview` (default) — all agents
  - `gemini-3.1-flash-lite-preview` — cost-optimised alternative
  - `gemini-3.1-pro-preview` — highest capability
- **Google Agent Development Kit (ADK)** — Multi-agent orchestration framework
- Configurable to support additional LLM providers per step

## Cloud & Infrastructure

- **Google Cloud Platform (GCP)** — Cloud hosting and services
- **GitHub Actions** — CI/CD for automated QA runs

## Browser Automation

- **Playwright** — Browser automation library (Chromium)
- Accessibility-tree-based interaction using `_snapshotForAI()` refs — no visual markers or CSS selectors
- Screenshots reserved for visual assertion verification (Validator agent)
