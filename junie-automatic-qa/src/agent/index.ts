import { z } from "genkit";
import { ai, model } from "../genkit";
import { navigateTo, findElement } from "../browser";
import { memory } from "../memory";
import { knowledgeRetriever } from "../knowledge";

// Tools
export const navigateTool = ai.defineTool(
  {
    name: "navigate",
    description: "Navigates the browser to a specific URL",
    inputSchema: z.object({ url: z.string().url() }),
    outputSchema: z.string(),
  },
  async ({ url }) => {
    try {
      await navigateTo(url);
      return `Navigated to ${url}`;
    } catch (e) {
      return `Failed to navigate: ${(e as Error).message}`;
    }
  },
);

export const findTool = ai.defineTool(
  {
    name: "find",
    description: "Finds an element on the page using a CSS selector",
    inputSchema: z.object({ selector: z.string() }),
    outputSchema: z.string(),
  },
  async ({ selector }) => {
    const el = await findElement(selector);
    return el ? `Element found: ${selector}` : `Element not found: ${selector}`;
  },
);

// Agent Flow
export const qaAgentFlow = ai.defineFlow(
  {
    name: "qaAgentFlow",
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (task) => {
    // 1. Retrieve Context
    const docs = await ai.retrieve({
      retriever: knowledgeRetriever,
      query: task,
      options: { k: 3 },
    });
    const context = docs.map((d) => d.text).join("\n");

    // 2. Load Memory
    const history = memory
      .getHistory()
      .map((h) => `${h.role}: ${h.content}`)
      .join("\n");

    // 3. Generate Plan & Execute
    // We use the model to decide tools to call.

    const prompt = `
      You are a QA automation expert.
      Task: ${task}
      
      Context from Knowledge Base:
      ${context}
      
      History:
      ${history}
      
      Use the available tools to complete the task.
      If you need to navigate, use navigateTool.
      If you need to check elements, use findTool.
      IMPORTANT: After navigating, you MUST check for at least one element to verify the page loaded.
    `;

    const response = await ai.generate({
      model: model.name,
      prompt: prompt,
      tools: [navigateTool, findTool],
      config: {
        temperature: 0.1,
      },
    });

    const resultText = response.text;

    // Update Memory
    memory.add("user", task);
    memory.add("model", resultText);

    return resultText;
  },
);
