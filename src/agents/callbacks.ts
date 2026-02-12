import { type CallbackContext, type LlmRequest, type LlmResponse } from '@google/adk';

/**
 * Injects the latest screenshot and element list into the model request.
 * This allows the agent to "see" the current state of the browser.
 */
export const injectScreenshotCallback = async ({ context, request }: {
  context: CallbackContext;
  request: LlmRequest;
}): Promise<LlmResponse | undefined> => {
  const screenshot = context.state.get('temp:latest_screenshot');
  const elements = context.state.get('temp:latest_elements');

  if (screenshot) {
    // In ADK, we can append to the last message or add a new part
    const lastMessage = request.contents[request.contents.length - 1];
    
    if (!lastMessage.parts) {
      lastMessage.parts = [];
    }
    
    // Add screenshot as an image part
    lastMessage.parts.push({
      inlineData: {
        mimeType: 'image/png',
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
