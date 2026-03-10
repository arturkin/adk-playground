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
 * Injects a reminder about unrecorded assertions into the model request.
 * Fires before every validator model call so the model can't forget to
 * call record_assertion for all assertions before writing a final verdict.
 */
export const validatorAssertionReminderCallback = async ({
  context,
  request,
}: {
  context: CallbackContext;
  request: LlmRequest;
}): Promise<LlmResponse | undefined> => {
  const assertionCountStr = context.state.get("assertion_count") as
    | string
    | undefined;
  const expectedCount = parseInt(assertionCountStr || "0", 10);

  if (expectedCount > 0) {
    const assertionsJson = context.state.get("assertions") as
      | string
      | undefined;
    const recordedAssertions = assertionsJson ? JSON.parse(assertionsJson) : [];
    const recorded = recordedAssertions.length;

    if (recorded < expectedCount) {
      const testAssertionsJson = context.state.get(
        "_test_assertions_json",
      ) as string | undefined;
      const allAssertions = testAssertionsJson
        ? JSON.parse(testAssertionsJson)
        : [];
      const recordedIds = new Set(recordedAssertions.map((a: any) => a.id));
      const missing = allAssertions.filter((a: any) => !recordedIds.has(a.id));

      const reminder =
        missing.length > 0
          ? `\n\n[MANDATORY REMINDER] You have recorded ${recorded}/${expectedCount} assertions. You MUST still call record_assertion for: ${missing.map((a: any) => `ID ${a.id} ("${a.description}")`).join(", ")}. Do NOT write a final verdict until ALL ${expectedCount} are recorded.`
          : `\n\n[MANDATORY REMINDER] You must call record_assertion ${expectedCount} time(s) before writing a final verdict.`;

      const lastMessage = request.contents[request.contents.length - 1];
      if (!lastMessage.parts) lastMessage.parts = [];
      lastMessage.parts.push({ text: reminder });
    }
  }

  return undefined;
};

/**
 * Injects the latest screenshot and element list into the model request.
 * Used only by the navigator agent — other agents call take_screenshot themselves
 * so they are forced into tool-calling mode before writing any free-form text.
 */
export const injectScreenshotCallback = async ({
  context,
  request,
}: {
  context: CallbackContext;
  request: LlmRequest;
}): Promise<LlmResponse | undefined> => {
  const screenshot = context.state.get("latest_screenshot");
  const textNodesScreenshot = context.state.get("latest_text_nodes_screenshot");
  const elements = context.state.get("latest_elements");
  const textNodes = context.state.get("latest_text_nodes");

  if (screenshot) {
    // In ADK, we can append to the last message or add a new part
    const lastMessage = request.contents[request.contents.length - 1];

    if (!lastMessage.parts) {
      lastMessage.parts = [];
    }

    // Add text node screenshot first (blue labels) if available
    if (textNodesScreenshot) {
      lastMessage.parts.push({
        text: "\n\nPage screenshot with text elements highlighted (blue labels, T-prefixed IDs):",
      });
      lastMessage.parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: textNodesScreenshot as string,
        },
      });
    }

    // Add interactive elements screenshot (red labels)
    lastMessage.parts.push({
      text: "\n\nPage screenshot with interactive elements highlighted (red labels, numeric IDs):",
    });
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

    // Add text node metadata so the agent can read contextual labels and headings
    if (textNodes) {
      lastMessage.parts.push({
        text: `\n\nText elements on screen (read-only, not clickable):\n${textNodes}`,
      });
    }
  }

  return undefined;
};
