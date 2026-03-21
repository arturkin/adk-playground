import { FunctionTool } from "@google/adk";
import { z } from "zod";

const taskCompletedParamsSchema = z.object({
  summary: z
    .string()
    .describe("A brief summary of what was accomplished and the final state."),
});

export const taskCompletedTool = new FunctionTool({
  name: "task_completed",
  description: "Signals that the assigned QA task has been completed.",
  parameters: taskCompletedParamsSchema as never,
  execute: async ({ summary }: { summary: string }, toolContext) => {
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
