import {
  type CallbackContext,
  type LlmRequest,
  type LlmResponse,
} from "@google/adk";

/**
 * Detects empty model responses (Gemini 3 + tools known issue) and injects a
 * nudge so the LoopAgent can continue rather than spinning silently.
 *
 * When a model returns a response with no content parts, ADK produces an
 * LlmResponse with errorCode set and no content. Without intervention the
 * LoopAgent just calls the model again indefinitely until maxIterations.
 *
 * By returning a synthetic text response here, the next iteration includes
 * this turn in the conversation history, which gives the model enough context
 * to produce a real tool call on the following attempt.
 */
export const emptyResponseNudgeCallback = ({
  response,
}: {
  context: CallbackContext;
  response: LlmResponse;
}): LlmResponse | undefined => {
  if (!response.content) {
    // ADK silently swallows model errors (404 model not found, 429 quota, etc.)
    // and emits an event with errorCode instead of throwing. Surface them clearly.
    if (response.errorCode) {
      console.error(
        `  \x1b[31m[Model Error] ${response.errorCode}: ${response.errorMessage ?? "(no message)"}\x1b[0m`,
      );
      if (response.errorCode === "NOT_FOUND" || response.errorMessage?.includes("not found")) {
        console.error(
          `  \x1b[31m[Model Error] The model does not exist in the API. Check MODEL_ALIASES in src/config/models.ts.\x1b[0m`,
        );
      }
    } else {
      console.warn(
        "  \x1b[33m[Warning] Model returned empty response — injecting nudge\x1b[0m",
      );
    }
    return {
      content: {
        role: "model",
        parts: [
          {
            text: "(No response generated. I must call one of my available tools to proceed.)",
          },
        ],
      },
    };
  }
  return undefined;
};

/**
 * Injects the latest screenshot and element list into the model request.
 * This allows the agent to "see" the current state of the browser.
 */
export const injectScreenshotCallback = async ({
  context,
  request,
}: {
  context: CallbackContext;
  request: LlmRequest;
}): Promise<LlmResponse | undefined> => {
  const screenshot = context.state.get("latest_screenshot");
  const elements = context.state.get("latest_elements");

  if (screenshot) {
    // In ADK, we can append to the last message or add a new part
    const lastMessage = request.contents[request.contents.length - 1];

    if (!lastMessage.parts) {
      lastMessage.parts = [];
    }

    // Add screenshot as an image part
    lastMessage.parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: screenshot as string,
      },
    });

    // Add elements metadata as a text part to help the LLM map visual IDs to roles/text
    if (elements) {
      lastMessage.parts.push({
        text: `\n\nInteractive elements on screen:\n${elements}`,
      });
    }
  }

  return undefined;
};
