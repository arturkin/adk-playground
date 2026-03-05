import { FunctionTool, type ToolContext } from "@google/adk";
import { z } from "zod";

const taskCompletedParamsSchema = z.object({
  summary: z
    .string()
    .describe("A brief summary of what was accomplished and the final state."),
});

export const taskCompletedTool = new FunctionTool({
  name: "task_completed",
  description: "Signals that the assigned QA task has been completed.",
  // @google/adk FunctionTool typing requires 'as any' for the schema if using Zod
  parameters: taskCompletedParamsSchema as any,
  execute: async ({ summary }: any, toolContext) => {
    if (!toolContext) throw new Error("ToolContext is required");
    // Escalate to exit the LoopAgent
    toolContext.actions.escalate = true;

    // Manually set navigation_result because LoopAgent + escalate
    // might bypass the automatic outputKey saving.
    toolContext.state.set("navigation_result", summary);

    return {
      status: "success",
      message: "Task completed successfully.",
      summary,
    };
  },
});
