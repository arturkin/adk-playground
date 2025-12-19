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
  Document.fromText(
    "For 'Self Drive' tours on guidetoiceland.is, look for a link with text 'Self-Drive Tours'. Valid selectors: \"a[href*='self-drive-tour-packages']\", \"a[id*='Self-Drive']\". Do NOT use 'title' attribute.",
    { source: "selectors" },
  ),
  Document.fromText(
    "To search, look for an input with placeholder 'Search' or name='q'. If a specific section 'Choose your perfect Icelandic experience' is requested, look for elements containing that text using broad checks, or fallback to known footer links for 'Self Drive'.",
    { source: "selectors" },
  ),
  Document.fromText(
    "When adding to cart, look for buttons with text 'Add to cart' or 'Book now'. Selector: \"button[type='submit']\", \".btn-action\".",
    { source: "selectors" },
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
