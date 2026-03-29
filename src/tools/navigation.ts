import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { navigateTo, scrollPage } from "../browser/index.js";
import { captureBrowserState } from "./helpers.js";

const paramsSchema = z.object({
  url: z.string().url().describe("The URL to navigate to"),
});

export const navigateTool = new FunctionTool({
  name: "navigate",
  description:
    "Navigates the browser to a specific URL and captures page state.",
  parameters: paramsSchema as never,
  execute: async ({ url }: { url: string }, toolContext) => {
    if (!toolContext) throw new Error("ToolContext is required");

    const currentUrl = toolContext.state.get("current_url") as
      | string
      | undefined;
    if (currentUrl) {
      const taskSteps =
        (toolContext.state.get("task_steps") as string | undefined) ?? "";
      if (!/\b(navigate|go to|open|visit|url)\b/i.test(taskSteps)) {
        return {
          status: "blocked",
          message:
            "Navigation blocked: no test step mentions navigating to a URL. You already navigated to the initial page. Use the existing accessibility tree to complete the remaining steps.",
        };
      }
    }

    try {
      await navigateTo(url);
      toolContext.state.set("current_url", url);
      const elementCount = await captureBrowserState(toolContext);
      return {
        status: "success",
        message: `Navigated to ${url}`,
        elementCount,
      };
    } catch (e) {
      return {
        status: "error",
        message: `Failed to navigate to ${url}: ${(e instanceof Error ? e : new Error(String(e))).message}`,
      };
    }
  },
});

const scrollParamsSchema = z.object({
  direction: z
    .enum(["up", "down", "top", "bottom"])
    .describe("The direction to scroll"),
});

export const scrollTool = new FunctionTool({
  name: "scroll",
  description:
    "Scrolls the page in a direction. Only allowed when the current test step explicitly requires scrolling.",
  parameters: scrollParamsSchema as never,
  execute: async (
    { direction }: { direction: "up" | "down" | "top" | "bottom" },
    toolContext,
  ) => {
    if (!toolContext) throw new Error("ToolContext is required");

    const taskSteps =
      (toolContext.state.get("task_steps") as string | undefined) ?? "";
    if (!/scroll|swipe/i.test(taskSteps)) {
      return {
        status: "blocked",
        message:
          "Scroll blocked: no test step mentions scrolling. The accessibility tree already includes off-screen elements — use element refs from the tree instead of scrolling.",
      };
    }

    try {
      await scrollPage(direction);
      const elementCount = await captureBrowserState(toolContext);
      return {
        status: "success",
        message: `Scrolled ${direction}`,
        elementCount,
      };
    } catch (e) {
      return {
        status: "error",
        message: `Failed to scroll ${direction}: ${(e instanceof Error ? e : new Error(String(e))).message}`,
      };
    }
  },
});
