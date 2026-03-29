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

export const refreshTreeTool = new FunctionTool({
  name: "refresh_tree",
  description:
    "LAST RESORT: Re-captures a full (non-incremental) accessibility tree from scratch, clearing all previous element context. Only use this after all other retry strategies have failed and you still cannot find the element you need.",
  parameters: z.object({}) as never,
  execute: async (_: Record<string, never>, toolContext) => {
    if (!toolContext) throw new Error("ToolContext is required");
    try {
      // Force a full (non-incremental) snapshot
      const { elements, tree } = await captureAccessibilitySnapshot();
      const screenshot = await getScreenshot();

      // Overwrite state with fresh full tree
      toolContext.state.set("latest_accessibility_tree", tree);
      toolContext.state.set("latest_elements", JSON.stringify(elements));
      toolContext.state.set("latest_snapshot_is_incremental", "false");
      toolContext.state.set("latest_screenshot", screenshot);
      // Reset step_count to 0 so next captureBrowserState produces a full tree too
      toolContext.state.set("step_count", "0");

      return {
        status: "success",
        message:
          "Full accessibility tree refreshed. All previous refs are invalidated — use ONLY refs from this new tree.",
        elementCount: elements.length,
      };
    } catch (e) {
      return {
        status: "error",
        message: `Failed to refresh tree: ${(e instanceof Error ? e : new Error(String(e))).message}`,
      };
    }
  },
});

const debugElementParamsSchema = z.object({
  ref: z
    .string()
    .describe("The accessibility ref of the element to inspect, e.g. 'e5'"),
});

export const debugElementTool = new FunctionTool({
  name: "debug_element",
  description:
    "Debug tool: returns full metadata for an element ref, its surrounding accessibility tree context, nearby sibling elements, and the current page URL.",
  parameters: debugElementParamsSchema as never,
  execute: async ({ ref }: { ref: string }, toolContext) => {
    if (!toolContext) throw new Error("ToolContext is required");
    try {
      const elementsJson =
        (toolContext.state.get("latest_elements") as string) || "[]";
      const elements: Array<Record<string, unknown>> = JSON.parse(elementsJson);
      const tree =
        (toolContext.state.get("latest_accessibility_tree") as string) || "";
      const currentUrl =
        (toolContext.state.get("current_url") as string) || "unknown";

      // Find the target element metadata
      const target = elements.find((el) => el["ref"] === ref) || null;

      // Find nearby elements in the list (by index proximity)
      const targetIdx = elements.findIndex((el) => el["ref"] === ref);
      const nearby =
        targetIdx >= 0
          ? elements
              .slice(Math.max(0, targetIdx - 3), targetIdx + 4)
              .map((el) => ({
                ref: el["ref"],
                role: el["role"],
                name: el["name"],
                value: el["value"],
                url: el["url"],
                disabled: el["disabled"],
                checked: el["checked"],
              }))
          : [];

      // Extract surrounding tree lines around the ref
      const treeLines = tree.split("\n");
      const refPattern = `[ref=${ref}]`;
      const matchIdx = treeLines.findIndex((line) =>
        line.includes(refPattern),
      );
      const treeContext =
        matchIdx >= 0
          ? treeLines.slice(Math.max(0, matchIdx - 5), matchIdx + 6).join("\n")
          : `ref ${ref} not found in current accessibility tree`;

      return {
        status: "success",
        currentUrl,
        targetElement: target || `Element with ref ${ref} not found in element list`,
        nearbyElements: nearby,
        treeContext,
        totalElements: elements.length,
      };
    } catch (e) {
      return {
        status: "error",
        message: `Debug failed: ${(e instanceof Error ? e : new Error(String(e))).message}`,
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
