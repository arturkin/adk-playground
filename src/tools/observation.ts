import { FunctionTool } from "@google/adk";
import { z } from "zod";
import {
  getScreenshot,
  captureAccessibilitySnapshot,
} from "../browser/index.js";

const takeScreenshotParamsSchema = z.object({
  label: z.string().optional().describe("Optional label for the screenshot"),
});

export const takeScreenshotTool = new FunctionTool({
  name: "take_screenshot",
  description:
    "Take a clean screenshot and capture the accessibility tree of the current page.",
  parameters: takeScreenshotParamsSchema as never,
  execute: async ({ label }: { label?: string }, toolContext) => {
    if (!toolContext) throw new Error("ToolContext is required");
    try {
      // Capture accessibility tree
      const { elements, tree } = await captureAccessibilitySnapshot();

      // Take a clean screenshot (no visual markers)
      const screenshot = await getScreenshot();

      toolContext.state.set("latest_screenshot", screenshot);
      toolContext.state.set("latest_accessibility_tree", tree);
      toolContext.state.set("latest_elements", JSON.stringify(elements));

      return {
        status: "success",
        message: `Screenshot taken${label ? `: ${label}` : ""}`,
        elementCount: elements.length,
      };
    } catch (e) {
      return {
        status: "error",
        message: `Failed to take screenshot: ${(e instanceof Error ? e : new Error(String(e))).message}`,
      };
    }
  },
});

export const getElementListTool = new FunctionTool({
  name: "get_element_list",
  description:
    "Returns the current list of accessible elements without taking a screenshot.",
  parameters: z.object({}) as never,
  execute: async (_: Record<string, never>, _toolContext) => {
    try {
      const { elements } = await captureAccessibilitySnapshot();

      return {
        status: "success",
        elements: elements.map((el) => ({
          ref: el.ref,
          role: el.role,
          name: el.name,
          value: el.value,
        })),
      };
    } catch (e) {
      return {
        status: "error",
        message: `Failed to get element list: ${(e instanceof Error ? e : new Error(String(e))).message}`,
      };
    }
  },
});
