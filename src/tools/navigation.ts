import { FunctionTool, type Context } from "@google/adk";
import { z } from "zod";
import { getBrowserManager, navigateTo, scrollPage } from "../browser/index.js";
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
    "Scrolls the page in a direction. Only use this if the element you need is NOT in the current element list.",
  parameters: scrollParamsSchema as never,
  execute: async ({ direction }: { direction: "up" | "down" | "top" | "bottom" }, toolContext) => {
    if (!toolContext) throw new Error("ToolContext is required");
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
