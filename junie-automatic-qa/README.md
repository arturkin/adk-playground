# Junie Automatic QA Agent

This agent uses Google Genkit to perform QA automation tasks.

## Setup

1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Configure environment:
    ```bash
    cp .env.example .env
    # Edit .env and add your GOOGLE_GENAI_API_KEY
    ```

## Running the Agent

To run the agent with a task:

```bash
npx ts-node src/index.ts "Go to https://guidetoiceland.is and check if the search bar is visible"
```

## Features

- **Genkit Flows**: Uses `@genkit-ai/flow` for robust agent logic.
- **Browser Automation**: Uses Puppeteer for browser interaction.
- **Memory**: Persists conversation history in `memory.json`.
- **Knowledge Base**: Simple retrieval for project context.
- **Extensible**: Easily add new tools in `src/agent/index.ts`.
