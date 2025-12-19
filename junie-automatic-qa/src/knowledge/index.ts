import { ai } from "../genkit";
import { Document } from "genkit/retriever";
import { z } from "genkit";

// Mock knowledge base
const documents: Document[] = [
  Document.fromText(
    "The application has two main domains: guidetoiceland.is and guidetoeurope.com.",
    { source: "overview" },
  ),
  Document.fromText(
    "To test the homepage, navigate to / and check for the body element.",
    { source: "testing_guide" },
  ),
];

export const knowledgeRetriever = ai.defineRetriever(
  {
    name: "knowledgeRetriever",
    configSchema: z.object({ k: z.number().optional() }),
  },
  async (input, options) => {
    // Simple keyword matching simulation
    // In a real app, use a Vector Store
    const query = input.text;

    // Return all docs for now as the KB is tiny, or filter
    return {
      documents: documents.filter(
        (d) => d.text.toLowerCase().includes(query.toLowerCase()) || true, // Return all for context if small
      ),
    };
  },
);
