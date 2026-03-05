import { FunctionTool } from "@google/adk";
import { z } from "zod";

const bugParamsSchema = z.object({
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  category: z.enum([
    "functional",
    "visual",
    "seo",
    "accessibility",
    "translation",
  ]),
  title: z.string(),
  description: z.string(),
  expected: z.string(),
  actual: z.string(),
});

export const recordBugTool = new FunctionTool({
  name: "record_bug",
  description: "Records a bug finding during the QA process.",
  // @google/adk FunctionTool typing requires 'as any' for the schema if using Zod
  parameters: bugParamsSchema as any,
  execute: async (bug: any, toolContext) => {
    if (!toolContext) throw new Error("ToolContext is required");
    const bugs = JSON.parse(toolContext.state.get("bugs") || "[]");
    const bugReport = {
      ...bug,
      id: `BUG-${Date.now()}`,
      timestamp: new Date().toISOString(),
      url: toolContext.state.get("current_url") || "unknown",
      viewport: toolContext.state.get("current_viewport") || "desktop",
      steps: [],
      screenshots: [`screenshot_${Date.now()}`],
    };
    bugs.push(bugReport);
    toolContext.state.set("bugs", JSON.stringify(bugs));

    return {
      status: "success",
      message: `Bug recorded: ${bug.title}`,
      bugId: bugReport.id,
    };
  },
});

const assertionParamsSchema = z.object({
  id: z
    .number()
    .describe("The ID of the assertion from the test assertions list"),
  passed: z.boolean().describe("Whether the assertion passed or failed"),
  evidence: z
    .string()
    .describe("Specific visual evidence or reason for failure"),
});

export const recordAssertionTool = new FunctionTool({
  name: "record_assertion",
  description: "Records a pass/fail result for a specific assertion by its ID.",
  // @google/adk FunctionTool typing requires 'as any' for the schema if using Zod
  parameters: assertionParamsSchema as any,
  execute: async (assertion: any, toolContext) => {
    if (!toolContext) throw new Error("ToolContext is required");

    const assertions = JSON.parse(toolContext.state.get("assertions") || "[]");
    const testAssertionsJson =
      (toolContext.state.get("_test_assertions_json") as string) || "[]";
    const originalAssertions = JSON.parse(testAssertionsJson);

    const original = originalAssertions.find((a: any) => a.id === assertion.id);
    if (!original) {
      return {
        status: "error",
        message: `Assertion with ID ${assertion.id} not found.`,
      };
    }

    const record = {
      id: assertion.id,
      description: original.description, // USE ORIGINAL DESCRIPTION
      passed: assertion.passed,
      evidence: assertion.evidence,
      timestamp: new Date().toISOString(),
    };

    // Structural safeguard: detect contradiction between evidence and passed status.
    // If the assertion expects something to be present/visible, but the evidence
    // describes absence, override passed=true to passed=false.
    if (record.passed === true) {
      const descLower = record.description.toLowerCase();
      const presenceIndicators = [
        "is visible",
        "are visible",
        "is displayed",
        "are displayed",
        "is present",
        "are present",
        "exists",
        "exist",
        "is found",
        "are found",
        "at least one",
        "at least",
        "is shown",
        "are shown",
        "is loaded",
        "are loaded",
      ];
      const assertionExpectsPresence = presenceIndicators.some((p) =>
        descLower.includes(p),
      );

      const evidenceLower = record.evidence.toLowerCase();
      const absenceIndicators = [
        "not found",
        "not visible",
        "not present",
        "not displayed",
        "does not exist",
        "no results",
        "was not",
        "cannot find",
        "unable to find",
        "could not find",
        "couldn't find",
        "did not find",
        "didn't find",
        "is missing",
        "are missing",
        "absent",
        "absence",
        "nowhere",
        "not on the page",
        "0 results",
        "zero results",
        "no matching",
        "not shown",
        "does not contain",
        "does not have",
        "were not",
        "is not",
        "are not",
        "wasn't",
        "aren't",
        "not located",
        "not detected",
        "not identified",
      ];
      const evidenceIndicatesAbsence =
        absenceIndicators.some((p) => evidenceLower.includes(p)) ||
        // Also catch "No <X> found/visible/present/..." patterns (e.g., "No Amazon product listings found")
        /\bno\s+\w+.*?\b(found|visible|present|displayed|shown|exist|appeared|detected)\b/i.test(
          record.evidence,
        );

      if (assertionExpectsPresence && evidenceIndicatesAbsence) {
        record.passed = false;
        record.evidence = `[AUTO-CORRECTED: Assertion expects presence but evidence indicates absence] ${record.evidence}`;
      }
    }

    assertions.push(record);
    toolContext.state.set("assertions", JSON.stringify(assertions));

    // Check for remaining unrecorded assertions and remind the LLM
    const recordedIds = new Set(assertions.map((a: any) => a.id));
    const unrecordedAssertions = originalAssertions.filter(
      (oa: any) => !recordedIds.has(oa.id),
    );

    let message = `Assertion ${assertion.id} recorded: ${original.description} (${record.passed ? "PASSED" : "FAILED"})`;
    if (unrecordedAssertions.length > 0) {
      message += `. REMAINING: You must still record ${unrecordedAssertions.length} more assertion(s): ${unrecordedAssertions
        .map((a: any) => `ID ${a.id} ("${a.description}")`)
        .join(", ")}. Call record_assertion for each one now.`;
    } else {
      message += `. All assertions have been recorded.`;
    }

    return {
      status: "success",
      message,
    };
  },
});
