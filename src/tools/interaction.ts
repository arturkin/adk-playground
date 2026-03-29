import { FunctionTool, type Context } from "@google/adk";
import { z } from "zod";
import {
  clickElement,
  typeElement,
  pressKey,
  hoverElement,
  getBrowserManager,
} from "../browser/index.js";
import { captureBrowserState } from "./helpers.js";
import type { AccessibilityElement } from "../types/browser.js";

/**
 * Looks up the element metadata from latest_elements state by ref.
 */
function getElementMeta(
  toolContext: Context,
  ref: string,
): AccessibilityElement | null {
  try {
    const elements: AccessibilityElement[] = JSON.parse(
      (toolContext.state.get("latest_elements") as string) || "[]",
    );
    return elements.find((el) => el.ref === ref) || null;
  } catch {
    return null;
  }
}

const clickParamsSchema = z.object({
  ref: z
    .string()
    .describe("The accessibility ref of the element to click, e.g. 'e5'"),
});

export const clickElementTool = new FunctionTool({
  name: "click_element",
  description:
    "Clicks on an element using its accessibility ref and captures page state.",
  parameters: clickParamsSchema as never,
  execute: async ({ ref }: { ref: string }, toolContext) => {
    if (!toolContext) throw new Error("ToolContext is required");
    try {
      const elMeta = getElementMeta(toolContext, ref);
      await clickElement(ref);
      const elementCount = await captureBrowserState(toolContext);
      const page = await getBrowserManager().getActivePage();
      return {
        status: "success",
        message: `Clicked element ${ref}`,
        clickedElement: elMeta,
        currentUrl: page.url(),
        elementCount,
      };
    } catch (e) {
      return {
        status: "error",
        message: `Failed to click element ${ref}: ${(e instanceof Error ? e : new Error(String(e))).message}`,
      };
    }
  },
});

export const hoverElementTool = new FunctionTool({
  name: "hover_element",
  description:
    "Hovers over an element using its accessibility ref and captures page state.",
  parameters: clickParamsSchema as never,
  execute: async ({ ref }: { ref: string }, toolContext) => {
    if (!toolContext) throw new Error("ToolContext is required");
    try {
      await hoverElement(ref);
      const elementCount = await captureBrowserState(toolContext);
      return {
        status: "success",
        message: `Hovered over element ${ref}`,
        elementCount,
      };
    } catch (e) {
      return {
        status: "error",
        message: `Failed to hover over element ${ref}: ${(e instanceof Error ? e : new Error(String(e))).message}`,
      };
    }
  },
});

const typeParamsSchema = z.object({
  ref: z
    .string()
    .describe("The accessibility ref of the element to type into, e.g. 'e7'"),
  text: z.string().describe("The text to type"),
});

export const typeElementTool = new FunctionTool({
  name: "type_element",
  description:
    "Types text into an element using its accessibility ref and captures page state.",
  parameters: typeParamsSchema as never,
  execute: async (
    { ref, text }: { ref: string; text: string },
    toolContext,
  ) => {
    if (!toolContext) throw new Error("ToolContext is required");
    try {
      await typeElement(ref, text);
      const elementCount = await captureBrowserState(toolContext);
      return {
        status: "success",
        message: `Typed into element ${ref}`,
        elementCount,
      };
    } catch (e) {
      return {
        status: "error",
        message: `Failed to type into element ${ref}: ${(e instanceof Error ? e : new Error(String(e))).message}`,
      };
    }
  },
});

const pressKeyParamsSchema = z.object({
  key: z.string().describe("The key to press (e.g., Enter, Tab, Escape)"),
});

export const pressKeyTool = new FunctionTool({
  name: "press_key",
  description: "Presses a keyboard key and captures page state.",
  parameters: pressKeyParamsSchema as never,
  execute: async ({ key }: { key: string }, toolContext) => {
    if (!toolContext) throw new Error("ToolContext is required");

    const taskSteps =
      (toolContext.state.get("task_steps") as string | undefined) ?? "";
    if (!/\b(key|keyboard|tab|enter|escape|press|hotkey)\b/i.test(taskSteps)) {
      return {
        status: "blocked",
        message:
          "Key press blocked: no test step mentions keyboard interaction. Use click_element or type_element to interact with elements instead.",
      };
    }

    try {
      await pressKey(key);
      const elementCount = await captureBrowserState(toolContext);
      return {
        status: "success",
        message: `Pressed key: ${key}`,
        elementCount,
      };
    } catch (e) {
      return {
        status: "error",
        message: `Failed to press key ${key}: ${(e instanceof Error ? e : new Error(String(e))).message}`,
      };
    }
  },
});
