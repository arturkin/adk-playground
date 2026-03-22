import { type Context, type LlmRequest, type LlmResponse } from "@google/adk";
import { log } from "../logger/index.js";

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
  context: Context;
  response: LlmResponse;
}): LlmResponse | undefined => {
  if (!response.content) {
    // ADK silently swallows model errors (404 model not found, 429 quota, etc.)
    // and emits an event with errorCode instead of throwing. Surface them clearly.
    if (response.errorCode) {
      log.error(
        `[Model Error] ${response.errorCode}: ${response.errorMessage ?? "(no message)"}`,
      );
      if (
        response.errorCode === "NOT_FOUND" ||
        response.errorMessage?.includes("not found")
      ) {
        log.error(
          `[Model Error] The model does not exist in the API. Check MODEL_ALIASES in src/config/models.ts.`,
        );
      }
    } else {
      log.warn("[Warning] Model returned empty response -- injecting nudge");
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
  context: Context;
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
      const testAssertionsJson = context.state.get("_test_assertions_json") as
        | string
        | undefined;
      const allAssertions = testAssertionsJson
        ? JSON.parse(testAssertionsJson)
        : [];
      const recordedIds = new Set(
        recordedAssertions.map((a: { id: number }) => a.id),
      );
      const missing = allAssertions.filter(
        (a: { id: number }) => !recordedIds.has(a.id),
      );

      const reminder =
        missing.length > 0
          ? `\n\n[MANDATORY REMINDER] You have recorded ${recorded}/${expectedCount} assertions. You MUST still call record_assertion for: ${missing.map((a: { id: number; description: string }) => `ID ${a.id} ("${a.description}")`).join(", ")}. Do NOT write a final verdict until ALL ${expectedCount} are recorded.`
          : `\n\n[MANDATORY REMINDER] You must call record_assertion ${expectedCount} time(s) before writing a final verdict.`;

      const lastMessage = request.contents[request.contents.length - 1];
      if (!lastMessage.parts) lastMessage.parts = [];
      lastMessage.parts.push({ text: reminder });
    }
  }

  return undefined;
};

/**
 * Injects the latest accessibility tree and element metadata into the model request.
 * Used only by the navigator agent — other agents call take_screenshot themselves
 * so they are forced into tool-calling mode before writing any free-form text.
 *
 * The navigator receives text-only context (accessibility tree + elements JSON)
 * instead of screenshots, dramatically reducing token cost.
 */
export const injectScreenshotCallback = async ({
  context,
  request,
}: {
  context: Context;
  request: LlmRequest;
}): Promise<LlmResponse | undefined> => {
  const accessibilityTree = context.state.get("latest_accessibility_tree");
  const elements = context.state.get("latest_elements");
  const isIncremental =
    context.state.get("latest_snapshot_is_incremental") === "true";

  if (accessibilityTree) {
    const lastMessage = request.contents[request.contents.length - 1];

    if (!lastMessage.parts) {
      lastMessage.parts = [];
    }

    // Label differs for incremental diffs vs full snapshots
    if (isIncremental && accessibilityTree === "(no changes)") {
      lastMessage.parts.push({
        text: "\n\nPage accessibility tree unchanged since last observation. All previously seen element refs remain valid.",
      });
    } else if (isIncremental) {
      lastMessage.parts.push({
        text: `\n\nIncremental accessibility tree diff (changes since last snapshot — [unchanged] refs are still valid):\n\`\`\`\n${accessibilityTree}\n\`\`\``,
      });
    } else {
      lastMessage.parts.push({
        text: `\n\nCurrent page accessibility tree (use refs like e1, e2 to interact with elements):\n\`\`\`\n${accessibilityTree}\n\`\`\``,
      });
    }

    // Add structured element metadata for easier lookup (skip for no-change snapshots)
    if (elements && !(isIncremental && accessibilityTree === "(no changes)")) {
      lastMessage.parts.push({
        text: `\n\nAccessible elements metadata (JSON):\n${elements}`,
      });
    }
  }

  return undefined;
};
