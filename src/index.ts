import { config } from "./config/index.js";
import { qaAgentFlow } from "./agent/index.js";
import { launchBrowser, closeBrowser } from "./browser/index.js";

async function main() {
  if (!config.apiKey) {
    console.error(
      "\x1b[31mError: GOOGLE_GENAI_API_KEY is not set.\x1b[0m\n" +
        "Please create a .env file based on .env.example and set your API key.\n" +
        "Get your key at: https://aistudio.google.com/app/apikey",
    );
    process.exit(1);
  }

  const task = process.argv[2];
  if (!task) {
    console.error("Please provide a task description as an argument.");
    process.exit(1);
  }

  console.log(`Starting Agent with task: "${task}"`);

  try {
    await launchBrowser();

    // Execute the flow
    const result = await qaAgentFlow(task);

    console.log("Agent finished with result:", result);
  } catch (error) {
    console.error("Agent failed:", error);
  } finally {
    // Wait for 5 seconds to let user see the result
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await closeBrowser();
  }
}

main();
