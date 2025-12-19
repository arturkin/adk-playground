import { z } from "genkit";
import { ai, model } from "../genkit";
import * as fs from "fs";
import {
  navigateTo,
  scrollPage,
  clickElement,
  typeElement,
  pressKey,
  getScreenshot,
  tagElements,
} from "../browser";
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

export const scrollTool = ai.defineTool(
  {
    name: "scroll",
    description: "Scrolls the page up, down, to the top, or to the bottom",
    inputSchema: z.object({
      direction: z.enum(["up", "down", "top", "bottom"]),
    }),
    outputSchema: z.string(),
  },
  async ({ direction }) => {
    try {
      await scrollPage(direction as "up" | "down" | "top" | "bottom");
      return `Scrolled ${direction}`;
    } catch (e) {
      return `Failed to scroll: ${(e as Error).message}`;
    }
  },
);

export const clickElementTool = ai.defineTool(
  {
    name: "clickElement",
    description:
      "Clicks on an element using its ID from the visual labels (Set-of-Mark).",
    inputSchema: z.object({ id: z.number() }),
    outputSchema: z.string(),
  },
  async ({ id }) => {
    try {
      await clickElement(id);
      return `Clicked element #${id}`;
    } catch (e) {
      return `Failed to click element #${id}: ${(e as Error).message}`;
    }
  },
);

export const typeElementTool = ai.defineTool(
  {
    name: "typeElement",
    description:
      "Types text into a specific element using its ID from the visual labels.",
    inputSchema: z.object({ id: z.number(), text: z.string() }),
    outputSchema: z.string(),
  },
  async ({ id, text }) => {
    try {
      await typeElement(id, text);
      return `Typed "${text}" into element #${id}`;
    } catch (e) {
      return `Failed to type into element #${id}: ${(e as Error).message}`;
    }
  },
);

export const pressKeyTool = ai.defineTool(
  {
    name: "pressKey",
    description: "Presses a key (e.g., 'Enter', 'Tab', 'Escape')",
    inputSchema: z.object({ key: z.string() }),
    outputSchema: z.string(),
  },
  async ({ key }) => {
    try {
      await pressKey(key);
      return `Pressed key: ${key}`;
    } catch (e) {
      return `Failed to press key: ${(e as Error).message}`;
    }
  },
);

const ALL_TOOLS = [
  navigateTool,
  scrollTool,
  clickElementTool,
  typeElementTool,
  pressKeyTool,
];

const TOOLS_MAP: Record<string, any> = {
  navigate: navigateTool,
  scroll: scrollTool,
  clickElement: clickElementTool,
  typeElement: typeElementTool,
  pressKey: pressKeyTool,
};

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

    const steps = task
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const formattedTask = steps.map((s, i) => `${i + 1}. ${s}`).join("\n");

    // Extract URL hint
    const urlMatch = task.match(/([a-zA-Z0-9-]+\.)?guidetoiceland\.is/);
    const urlHint = urlMatch
      ? `IMPORTANT: The target URL is 'https://${urlMatch[0]}'. Use this EXACT spelling.`
      : "";

    // 2. Prepare History
    const historyEntries = memory.getHistory();
    const history: any[] = historyEntries.map((h) => ({
      role: h.role,
      content: h.content,
    }));

    // Add current task
    const systemPrompt = `
      You are a QA automation expert.
      
      Your goal is to complete the following test case steps sequentially:
      ${formattedTask}
      
      ${urlHint}
      
      Context from Knowledge Base:
      ${context}
      
      You will receive screenshots of the page after every action.
      In the screenshots, INTERACTIVE ELEMENTS ARE LABELED WITH RED NUMBERS (IDs).
      You also receive a JSON list of labeled elements. Use it to verify the text content of the buttons/links.
      
      Tools available:
      - navigate(url): Go to a website.
      - clickElement(id): Click on an element using its numeric label ID.
      - typeElement(id, text): Type text into an element using its numeric label ID.
      - pressKey(key): Press keys like Enter.
      - scroll(direction): Scroll the page.

      Strategy:
      1. CRITICAL: Always output a THOUGHT first. Identify the element you need to interact with and its ID (e.g., "I need to click the search button, which is labeled #12").
      2. USE THE LABELS: Do NOT guess coordinates. Look for the red tags on the elements or use the text in the JSON list to find the ID.
      3. EXECUTE: Call the appropriate tool with the ID.
      4. NAVIGATE: Copy the URL exactly.
      5. TYPE: Use typeElement(id, text) directly. No need to click first.
      6. WAIT: If the page is loading or you just clicked a dropdown, you can just output a thought "Waiting for load" and the loop will continue with a new screenshot.
      7. DROPDOWNS: When you click a dropdown, wait for the next screenshot to see the options. Do NOT navigate again.
      8. FINISH: When ALL steps are completed, output "TASK COMPLETED" and a brief summary. Do NOT call any tools when finished.
    `;

    // The current input for the model
    let currentInput: any = [{ text: systemPrompt }];

    let finalResult = "";

    // Manual Loop
    for (let i = 0; i < 20; i++) {
      const response = await ai.generate({
        model: model.name,
        messages: history,
        prompt: currentInput,
        tools: ALL_TOOLS,
        config: { temperature: 0.1 },
        returnToolRequests: true,
      });

      // Add the input we used to history
      history.push({ role: "user", content: currentInput });

      const responseMessage = response.message;
      if (!responseMessage) {
        throw new Error("No message returned from model");
      }
      history.push(responseMessage);

      const toolRequests = responseMessage.content.filter(
        (c: any) => c.toolRequest,
      );

      let toolExecuted = false;

      if (toolRequests.length === 0) {
        if (response.text.includes("TASK COMPLETED")) {
          finalResult = response.text;
          break;
        }
        console.log("Agent is waiting/thinking...");
        await new Promise((resolve) => setTimeout(resolve, 3000));
        // Force loop to continue with new screenshot
        toolExecuted = true;
      }

      // Execute Tools
      for (const part of toolRequests) {
        const toolReq = part.toolRequest;
        if (!toolReq) continue;

        const tool = TOOLS_MAP[toolReq.name];
        let output = "Tool not found";
        if (tool) {
          try {
            output = await tool(toolReq.input);
            toolExecuted = true;
          } catch (e) {
            output = (e as Error).message;
          }
        }

        // Add tool response to history immediately
        history.push({
          role: "tool",
          content: [
            {
              toolResponse: {
                name: toolReq.name,
                ref: toolReq.ref,
                output: output,
              },
            },
          ],
        });
      }

      // WAIT for UI updates/animations
      if (toolExecuted) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Take screenshot and set as next input
      if (toolExecuted) {
        try {
          const elementList = await tagElements();
          const screenshot = await getScreenshot();

          // DEBUG: Save tagged screenshot
          try {
            if (!fs.existsSync("debug")) fs.mkdirSync("debug");
            fs.writeFileSync(
              `debug/step_${i}.jpg`,
              Buffer.from(screenshot, "base64"),
            );
          } catch (e) {
            console.error("Failed to save debug screenshot:", e);
          }

          currentInput = [
            {
              media: {
                url: `data:image/jpeg;base64,${screenshot}`,
                contentType: "image/jpeg",
              },
            },
            {
              text: `Screenshot of the current page. \nReference Steps:\n${formattedTask}\n\nInteractive Elements:\n${JSON.stringify(elementList)}\n\nCheck the history to see which steps are ALREADY DONE. Execute the NEXT step.`,
            },
          ];
        } catch (e) {
          currentInput = [
            { text: "Failed to take screenshot: " + (e as Error).message },
          ];
        }
      } else {
        // Should not happen if toolRequests > 0
        break;
      }
    }

    // Update Memory (Simplified)
    memory.add("user", task);
    memory.add("model", finalResult);

    return finalResult;
  },
);
