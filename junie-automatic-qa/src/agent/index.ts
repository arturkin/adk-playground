import { z } from "genkit";
import { ai, model } from "../genkit";
import {
  navigateTo,
  scrollPage,
  clickElementByText,
  typeText,
  pressKey,
  getScreenshot,
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

export const clickTool = ai.defineTool(
  {
    name: "click",
    description: "Clicks on an element containing the specified text",
    inputSchema: z.object({ text: z.string() }),
    outputSchema: z.string(),
  },
  async ({ text }) => {
    try {
      await clickElementByText(text);
      return `Clicked element with text: ${text}`;
    } catch (e) {
      return `Failed to click element: ${(e as Error).message}`;
    }
  },
);

export const typeTool = ai.defineTool(
  {
    name: "type",
    description: "Types text into the currently focused element",
    inputSchema: z.object({ text: z.string() }),
    outputSchema: z.string(),
  },
  async ({ text }) => {
    try {
      await typeText(text);
      return `Typed text: ${text}`;
    } catch (e) {
      return `Failed to type text: ${(e as Error).message}`;
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

const ALL_TOOLS = [navigateTool, scrollTool, clickTool, typeTool, pressKeyTool];

const TOOLS_MAP: Record<string, any> = {
  navigate: navigateTool,
  scroll: scrollTool,
  click: clickTool,
  type: typeTool,
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

    const steps = task.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    const formattedTask = steps.map((s, i) => `${i + 1}. ${s}`).join('\n');

    // Extract URL hint
    const urlMatch = task.match(/([a-zA-Z0-9-]+\.)?guidetoiceland\.is/);
    const urlHint = urlMatch ? `IMPORTANT: The target URL is 'https://${urlMatch[0]}'. Use this EXACT spelling.` : "";

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
      Use the visual information to decide what to do next.
      
      Tools available:
      - navigate(url): Go to a website.
      - click(text): Click an element by its text.
      - type(text): Type into focused element.
      - pressKey(key): Press keys like Enter.
      - scroll(direction): Scroll the page.

      Strategy:
      1. ANALYZE the current step from the list.
      2. CHECK the screenshot to see if the element for the step is visible.
      3. IF visible, execute the action.
      4. IF NOT visible, scroll or wait.
      5. ALWAYS output a thought explaining which step you are working on before calling a tool.
      6. Navigate to the site. COPY THE URL EXACTLY from the first step. Do not correct spelling. If it lacks 'https://', add it. DO NOT ADD 'www'. Remove any trailing punctuation. Common mistake: 'guidetoeiceland' (WRONG). Correct: 'guidetoiceland'.
      7. Verify page load visually.
      8. Interact using text on buttons/links.
      9. If you need to search, click the input (if it has text/placeholder) or just type if focused.
      10. Do not repeat steps that are already completed.
      11. If you are on the correct page, proceed to the next action immediately.
    `;

    // The current input for the model
    let currentInput: any = [{ text: systemPrompt }];

    let finalResult = "";

    // Manual Loop
    for (let i = 0; i < 20; i++) {
      const response = await ai.generate({
        model: model.name,
        history: history,
        prompt: currentInput,
        tools: ALL_TOOLS,
        config: { temperature: 0.1 },
        returnToolRequests: true,
      });

      // Add the input we used to history
      history.push({ role: "user", content: currentInput });

      const responseMessage = response.message;
      history.push(responseMessage);

      const toolRequests = responseMessage.content.filter(
        (c: any) => c.toolRequest,
      );

      if (toolRequests.length === 0) {
        finalResult = response.text;
        break;
      }

      // Execute Tools
      let toolExecuted = false;
      for (const part of toolRequests) {
        const toolReq = part.toolRequest;
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

      // Take screenshot and set as next input
      if (toolExecuted) {
        try {
          const screenshot = await getScreenshot();
          currentInput = [
            {
              media: {
                url: `data:image/jpeg;base64,${screenshot}`,
                contentType: "image/jpeg",
              },
            },
            { text: `Screenshot of the current page. \nReference Steps:\n${formattedTask}\n\nCheck the history to see which steps are ALREADY DONE. Execute the NEXT step.` },
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
