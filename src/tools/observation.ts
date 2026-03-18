import { FunctionTool, type Context } from "@google/adk";
import { z } from "zod";
import {
  tagElements,
  tagTextNodes,
  getScreenshot,
  clearMarkers,
} from "../browser/index.js";

const takeScreenshotParamsSchema = z.object({
  label: z.string().optional().describe("Optional label for the screenshot"),
});

export const takeScreenshotTool = new FunctionTool({
  name: "take_screenshot",
  description:
    "Explicitly take a screenshot with element tagging and save it to state.",
  // @google/adk FunctionTool typing requires 'as any' for the schema if using Zod
  parameters: takeScreenshotParamsSchema as any,
  execute: async ({ label }: any, toolContext) => {
    if (!toolContext) throw new Error("ToolContext is required");
    try {
      // Clear stale markers from previous capture cycle
      await clearMarkers();

      // Tag text nodes (blue, offset posMode) then interactive elements (red)
      const textNodes = await tagTextNodes(0);
      const elements = await tagElements(0);

      // Single screenshot with both marker types visible
      const screenshot = await getScreenshot();

      toolContext.state.set("latest_screenshot", screenshot);
      toolContext.state.set("latest_elements", JSON.stringify(elements));
      toolContext.state.set("latest_text_nodes", JSON.stringify(textNodes));

      return {
        status: "success",
        message: `Screenshot taken${label ? `: ${label}` : ""}`,
        elementCount: elements.length,
      };
    } catch (e) {
      return {
        status: "error",
        message: `Failed to take screenshot: ${(e as Error).message}`,
      };
    }
  },
});

export const getElementListTool = new FunctionTool({
  name: "get_element_list",
  description:
    "Returns the current list of interactive elements without taking a screenshot.",
  // @google/adk FunctionTool typing requires 'as any' for the schema if using Zod
  parameters: z.object({}) as any,
  execute: async (_: any, toolContext) => {
    try {
      const elements = await tagElements(0);

      return {
        status: "success",
        elements: elements.map((el) => ({
          id: el.id,
          tagName: el.tagName,
          text: el.text,
          role: el.role,
        })),
      };
    } catch (e) {
      return {
        status: "error",
        message: `Failed to get element list: ${(e as Error).message}`,
      };
    }
  },
});
