import { GoogleGenAI } from "@google/genai";
import { formatTestMarkdown } from "../tools/planning.js";

export interface ConversionInput {
  playwrightCode: string;
  url: string;
  viewport: string;
  title?: string;
}

interface TestData {
  title: string;
  url: string;
  viewport: string;
  tags: string[];
  priority: "low" | "medium" | "high" | "critical";
  steps: Array<{ description: string; assertions?: string[] }>;
  expectedOutcome: string;
  assertions: string[];
}

export interface ConversionResult {
  markdown: string;
  questions: string[] | null;
}

interface LlmResponseData extends TestData {
  questions: string[] | null;
}

function buildPrompt(input: ConversionInput): string {
  return `You are a QA test planner. Convert this Playwright recording into a structured test specification.

PLAYWRIGHT RECORDING:
${input.playwrightCode}

TARGET URL: ${input.url}
VIEWPORT: ${input.viewport}
${input.title ? `SUGGESTED TITLE: ${input.title}` : ""}

Return a JSON object with EXACTLY this structure (no markdown fences, just raw JSON):
{
  "title": "string - descriptive test name",
  "url": "${input.url}",
  "viewport": "${input.viewport}",
  "tags": ["array", "of", "lowercase", "tags"],
  "priority": "low|medium|high|critical",
  "steps": [
    { "description": "Human-readable step (no code, no selectors)" },
    { "description": "Step with assertions", "assertions": ["Visible state to verify"] }
  ],
  "expectedOutcome": "What should be true when test completes successfully",
  "assertions": ["Final assertion 1", "Final assertion 2"],
  "questions": null
}

## CRITICAL: NO SELECTORS OR TECHNICAL IDENTIFIERS

The test runner is an AI agent that navigates using visual accessibility snapshots — it has NO access to CSS selectors, IDs, classes, or XPath. Steps must describe what a human sees on screen, not how a developer would target an element in code.

FORBIDDEN in steps (causes test failure):
- CSS selectors: #search-btn, .form-control, [data-testid="..."]
- Playwright locators: getByRole(), getByTestId(), locator(), nth()
- Any reference to HTML attributes, class names, or DOM structure

REQUIRED: Describe elements by their VISIBLE LABEL, PURPOSE, or POSITION as a user would see them.

## STYLE GUIDE: Match this writing style exactly

Good step examples from existing tests in this codebase:
- "Locate search widget"
- "In search widget, locate date picker with label 'Select dates' and click on the starting date"
- "Interact with 'Choose experience' input field and pick 'Sightseeing'"
- "Click Search Now button"
- "Locate filters on the left side of the page"
- "Apply Destination filter, choose 'Blue Lagoon'"
- "Click flying from field, type New York, wait for popup, click on the list item"

Bad step examples (DO NOT write like this):
- "Click on element with role 'button' and name 'Search'" (technical)
- "Fill locator('#departure').with('NYC')" (code)
- "Click .search-widget .date-picker" (selector)
- "Click getByTestId('submit-btn')" (locator API)

## GROUPING ACTIONS

Group related micro-actions into one meaningful step:
- Multiple clicks/types on the same field = one step
- "click input → type text → press Enter" = "Type 'X' in the Y field and submit"
- "click dropdown → click option" = "Select 'X' from the Y dropdown"

## RULES

- Steps describe what to visually look for and what to do — as a human would explain it
- Include inline assertions (step.assertions) when a visible state change is expected after the step
- Final assertions describe the end state of the page
- If an element's purpose is unclear from the Playwright code, add a question asking what it is
- Set "questions" to null if everything is clear
- Tags: lowercase, feature area (e.g. "search", "navigation", "checkout", "filters")
- Priority: "critical" for core conversion flows, "high" for important features, "medium" for standard`;
}

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateLlmResponse(data: unknown): data is LlmResponseData {
  if (!isRecord(data)) return false;
  if (
    !(
      typeof data["title"] === "string" &&
      typeof data["url"] === "string" &&
      typeof data["viewport"] === "string" &&
      Array.isArray(data["tags"]) &&
      Array.isArray(data["steps"]) &&
      typeof data["expectedOutcome"] === "string" &&
      Array.isArray(data["assertions"]) &&
      ("questions" in data
        ? data["questions"] === null || Array.isArray(data["questions"])
        : true)
    )
  ) {
    return false;
  }
  const priority = data["priority"];
  if (
    typeof priority !== "string" ||
    !["low", "medium", "high", "critical"].includes(priority)
  ) {
    throw new Error(
      `LLM response has invalid priority value. Must be one of: low, medium, high, critical`,
    );
  }
  return true;
}

function parseJsonResponse(text: string): LlmResponseData {
  const cleaned = stripMarkdownFences(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Failed to parse LLM response as JSON: ${message}. Raw text: ${cleaned.substring(0, 200)}`,
    );
  }

  if (!validateLlmResponse(parsed)) {
    throw new Error(
      "LLM response is missing required fields (title, url, viewport, tags, priority, steps, expectedOutcome, assertions)",
    );
  }

  return parsed;
}

async function generateContent(
  genai: GoogleGenAI,
  model: string,
  prompt: string,
): Promise<string> {
  const response = await genai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function parseWithRetry(
  genai: GoogleGenAI,
  model: string,
  initialText: string,
  originalPrompt: string,
): Promise<LlmResponseData> {
  try {
    return parseJsonResponse(initialText);
  } catch {
    const retryPrompt = `${originalPrompt}

IMPORTANT: Your previous response could not be parsed as JSON. Return ONLY the raw JSON object, with no markdown code fences, no explanation, just the JSON.`;
    const retryText = await generateContent(genai, model, retryPrompt);
    return parseJsonResponse(retryText);
  }
}

export async function convertRecordingToTest(
  input: ConversionInput,
  apiKey: string,
  model: string,
): Promise<ConversionResult> {
  const genai = new GoogleGenAI({ apiKey });
  const prompt = buildPrompt(input);

  const rawText = await generateContent(genai, model, prompt);
  const parsedData = await parseWithRetry(genai, model, rawText, prompt);

  const markdown = formatTestMarkdown(parsedData);
  return { markdown, questions: parsedData.questions };
}

export async function refineWithAnswers(
  previousResult: ConversionResult,
  answers: string,
  input: ConversionInput,
  apiKey: string,
  model: string,
): Promise<ConversionResult> {
  const genai = new GoogleGenAI({ apiKey });

  const prompt = `${buildPrompt(input)}

PREVIOUS RESULT:
${previousResult.markdown}

The user has provided answers to your questions:
${answers}

Please revise your test specification with these answers incorporated.
Return the same JSON format with questions: null (since all questions are answered).`;

  const rawText = await generateContent(genai, model, prompt);
  const parsedData = await parseWithRetry(genai, model, rawText, prompt);

  const markdown = formatTestMarkdown(parsedData);
  return { markdown, questions: parsedData.questions };
}
