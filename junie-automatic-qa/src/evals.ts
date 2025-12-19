import { ai, model } from "./genkit";
import { launchBrowser, closeBrowser } from "./browser";
import { qaAgentFlow } from "./agent";
import { memory } from "./memory";

interface TestCase {
  id: string;
  input: string;
  expectedCriteria: string;
}

const dataset: TestCase[] = [
  // {
  //   id: "nav_iceland",
  //   input: "Go to guidetoiceland.is and check if the main page loads",
  //   expectedCriteria:
  //     "The agent should navigate to 'https://guidetoiceland.is' and confirm the page or an element on it was found.",
  // },
  {
    id: "search",
    input: `Go to guidetoiceland.is,
      Click on 'Choose your perfect Icelandic experience' Choose 'self drive' in the input dropdown. 
      DO NOT scroll the page. Press 'Search now' button on the right side of the page, on the top. .
      Wait for search page to load the search results. 
      Then, select any tour from the list, click on it and navigate to tour page. 
      Add tour to cart. 
      Wait for the cart page to load.`,
    expectedCriteria:
      "The agent should navigate to 'https://guidetoiceland.is', search for the tours, add single tour to the cart and go to cart page.",
  },
  // {
  //   id: "nav_iceland_footer",
  //   input:
  //     "Go to guidetoiceland.is, scroll down to the bottom and check if page footer is present",
  //   expectedCriteria:
  //     "The agent should navigate to 'https://guidetoiceland.is', scroll to the bottom of the page and confirm the page footer is present.",
  // },
  // {
  //   id: "nav_europe",
  //   input: "Open guidetoeurope.com and find the search bar",
  //   expectedCriteria:
  //     "The agent should navigate to 'https://guidetoeurope.com' and attempt to find a search bar selector.",
  // },
];

async function evaluateResult(
  input: string,
  output: string,
  criteria: string,
): Promise<{ passed: boolean; reason: string }> {
  const prompt = `
    You are an AI evaluator.
    
    Task: ${input}
    
    Agent Output: ${output}
    
    Success Criteria: ${criteria}
    
    Evaluate if the Agent Output satisfies the Success Criteria.
    If it does, return "PASS". If not, return "FAIL" followed by a brief reason.
    Format: PASS or FAIL: <reason>
  `;

  const response = await ai.generate({
    model: model.name,
    prompt: prompt,
    config: { temperature: 0 },
  });

  const text = response.text.trim();
  const passed = text.startsWith("PASS");
  const reason = text.replace(/^(PASS|FAIL):?\s*/, "");

  return { passed, reason };
}

async function runEvals() {
  if (!process.env.GOOGLE_GENAI_API_KEY && !process.env.GOOGLE_API_KEY) {
    console.error(
      "\x1b[31mError: GOOGLE_GENAI_API_KEY is not set.\x1b[0m\n" +
        "Please create a .env file based on .env.example and set your API key.\n" +
        "Get your key at: https://aistudio.google.com/app/apikey",
    );
    process.exit(1);
  }

  console.log("Starting evaluations...");

  // Use a separate memory file for evaluations to avoid wiping production history
  memory.setFile("memory.test.json");

  // Initialize browser
  await launchBrowser();

  const results = [];

  try {
    for (const testCase of dataset) {
      console.log(`\nRunning Test Case: ${testCase.id}`);
      console.log(`Input: ${testCase.input}`);

      // Clear memory before each test case
      memory.clear();

      try {
        // Run the agent flow
        const result = await qaAgentFlow(testCase.input);
        console.log(`Agent Output: ${result}`);

        // Evaluate
        const evalResult = await evaluateResult(
          testCase.input,
          result,
          testCase.expectedCriteria,
        );

        console.log(`Evaluation: ${evalResult.passed ? "✅ PASS" : "❌ FAIL"}`);
        if (!evalResult.passed) {
          console.log(`Reason: ${evalResult.reason}`);
        }

        results.push({ ...testCase, ...evalResult });
      } catch (error) {
        console.error(`Error running test case ${testCase.id}:`, error);
        results.push({
          ...testCase,
          passed: false,
          reason: `Exception: ${(error as Error).message}`,
        });
      }
    }
  } finally {
    await closeBrowser();
  }

  // Summary
  console.log("\n--- Evaluation Summary ---");
  const passedCount = results.filter((r) => r.passed).length;
  console.log(
    `Total: ${results.length}, Passed: ${passedCount}, Failed: ${results.length - passedCount}`,
  );

  if (passedCount < results.length) {
    process.exit(1);
  }
}

runEvals().catch((err) => {
  console.error("Evaluation script failed:", err);
  process.exit(1);
});
