import { genkit, z } from "genkit";
import { GoogleGenAI } from "@google/genai";

// Initialize client
const genai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || "",
});

// Model mapping for friendly names
const MODEL_MAP: Record<string, string> = {
  "thinking": "gemini-exp-1206",
  "flash-2.5": "gemini-2.5-flash", 
  "pro-latest": "gemini-pro-latest",
  "flash-2.0": "gemini-2.0-flash",
  "gemini-2.0-flash-thinking-exp": "gemini-exp-1206"
};

// Get model from env or default
const envModel = process.env.GOOGLE_GENAI_MODEL || "gemini-2.5-flash";
const selectedModelName = MODEL_MAP[envModel] || envModel;

export const geminiModel = {
  name: selectedModelName,
  configSchema: z.object({
    temperature: z.number().optional(),
    topK: z.number().optional(),
    topP: z.number().optional(),
  }),
};

export function googleGenai(ai: ReturnType<typeof genkit>) {
  ai.defineModel(
    {
      name: geminiModel.name,
      configSchema: geminiModel.configSchema,
    },
    async (request, streamingCallback) => {
      // Convert messages
      const contents = [];
      const toolRefToName = new Map<string, string>();

      for (const m of request.messages) {
        let role: string = m.role;
        if (role === "tool") role = "function";

        const parts = [];
        for (const c of m.content) {
          if (c.text) {
            parts.push({ text: c.text });
          } else if (c.toolRequest) {
            toolRefToName.set(c.toolRequest.ref || "", c.toolRequest.name);
            parts.push({
              functionCall: {
                name: c.toolRequest.name,
                args: c.toolRequest.input,
              },
            });
          } else if (c.toolResponse) {
            const name = toolRefToName.get(c.toolResponse.ref || "") || "unknown";
            parts.push({
              functionResponse: {
                name: name,
                response: { result: c.toolResponse.output },
              },
            });
          }
        }
        if (parts.length > 0) {
            contents.push({ role, parts });
        }
      }

      // Handle tools
      let tools = undefined;
      if (request.tools && request.tools.length > 0) {
        tools = [
          {
            functionDeclarations: request.tools.map((t) => ({
              name: t.name,
              description: t.description,
              parameters: t.inputSchema,
            })),
          },
        ];
      }

      console.log(`[GoogleGenAI] Generating with model: ${selectedModelName}`);

      const response = await genai.models.generateContent({
        model: selectedModelName,
        contents: contents as any,
        config: {
          temperature: request.config?.temperature,
          topK: request.config?.topK,
          topP: request.config?.topP,
          tools: tools as any,
        },
      });

      const anyResponse = response as any;
      // console.log("GenAI Response:", JSON.stringify(anyResponse, null, 2));

      const toolRequests: any[] = [];
      let text = "";

      if (anyResponse.candidates && anyResponse.candidates.length > 0) {
        const parts = anyResponse.candidates[0].content?.parts;
        if (parts) {
          for (const part of parts) {
            if (part.text) {
              text += part.text;
            } else if (part.functionCall) {
              toolRequests.push({
                toolRequest: {
                  ref: Math.random().toString(36).substring(7), // Random ref
                  name: part.functionCall.name,
                  input: part.functionCall.args,
                }
              });
            }
          }
        }
      } else if (typeof anyResponse.text === "function") {
         try {
           text = anyResponse.text();
         } catch(e) { /* ignore */ }
      }

      console.log(`[GoogleGenAI] Response: ${text.substring(0, 100)}${text.length > 100 ? "..." : ""} | Tools: ${toolRequests.length}`);
      // console.log("Parsed ToolRequests:", JSON.stringify(toolRequests, null, 2));

      const content: any[] = [];
      if (text) {
        content.push({ text });
      }
      // Add tool requests to content as well
      toolRequests.forEach(tr => content.push(tr));

      return {
        message: {
          role: "model",
          content: content,
        },
        // toolRequests property is redundant if in content? keeping just in case or removing?
        // In v1, it usually scans content. Let's try only content.
      };
    },
  );
}
