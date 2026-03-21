import { TestCaseResult } from "../types/report.js";
import { FailureLesson, FailureCategory } from "../types/lessons.js";

/**
 * Analyzes a failed test case and produces a failure lesson.
 */
export function analyzeFailure(
  result: TestCaseResult,
  runId: string,
  prevConsecutiveCount: number,
): FailureLesson {
  const category = categorizeFailure(result);
  const advice = buildAdvice(result, category);
  const analysis = buildAnalysis(result, category);
  const failureReason = buildFailureReason(result, category);

  return {
    testId: result.testId,
    runId,
    timestamp: new Date().toISOString(),
    failureReason,
    failureCategory: category,
    analysis,
    advice,
    failedStep: extractFailedStep(result),
    consecutiveFailures: prevConsecutiveCount + 1,
    resolved: false,
  };
}

/**
 * Categorizes the failure based on error patterns and evidence.
 */
function categorizeFailure(result: TestCaseResult): FailureCategory {
  const error = result.error?.toLowerCase() || "";
  const validationOutput = result.validationOutput?.toLowerCase() || "";
  const agentOutput = result.agentOutput?.toLowerCase() || "";

  // Check for navigation errors
  if (
    error.includes("navigation") ||
    error.includes("timeout") ||
    agentOutput.includes("http error") ||
    agentOutput.includes("page did not load") ||
    agentOutput.includes("failed to navigate")
  ) {
    return "navigation_error";
  }

  // Check for element not found
  if (
    error.includes("element not found") ||
    error.includes("no element") ||
    agentOutput.includes("cannot find") ||
    agentOutput.includes("element is not") ||
    agentOutput.includes("not in the list")
  ) {
    return "element_not_found";
  }

  // Check for popup/overlay issues
  if (
    agentOutput.includes("intercepted") ||
    agentOutput.includes("overlay") ||
    agentOutput.includes("cookie") ||
    agentOutput.includes("popup") ||
    agentOutput.includes("banner")
  ) {
    return "popup_overlay";
  }

  // Check for timing issues
  if (
    error.includes("timing") ||
    error.includes("wait") ||
    agentOutput.includes("not loaded") ||
    agentOutput.includes("still loading") ||
    agentOutput.includes("not rendered")
  ) {
    return "timing_issue";
  }

  // Check for assertion mismatches
  if (result.assertions.length > 0) {
    const hasFailedAssertions = result.assertions.some((a) => !a.passed);
    if (hasFailedAssertions) {
      return "assertion_mismatch";
    }
  }

  // Check for test definition issues
  if (
    validationOutput.includes("incomplete") ||
    validationOutput.includes("test definition") ||
    (result.assertions.length === 0 && result.status === "failed")
  ) {
    return "test_definition_issue";
  }

  return "unknown";
}

/**
 * Builds actionable advice based on failure category.
 */
function buildAdvice(
  result: TestCaseResult,
  category: FailureCategory,
): string {
  switch (category) {
    case "navigation_error":
      return "Check that the navigate tool is called correctly. Verify the URL is accessible. If HTTP errors persist, try reloading the page or check for network issues.";

    case "element_not_found":
      return "Wait longer for the page to fully render. Try scrolling to reveal the element. Look for alternative selectors (className, ariaLabel, placeholder). Check if the element has a different text/label than expected.";

    case "timing_issue":
      return "Wait for the page to fully render before interacting. Look for loading indicators to disappear. Add delays after navigation or clicks that trigger page changes.";

    case "popup_overlay":
      return 'Dismiss cookie consent banners, popups, or overlays FIRST before attempting to click other elements. Look for "Accept", "Allow", close buttons, or X icons.';

    case "assertion_mismatch": {
      const failedAssertions = result.assertions.filter((a) => !a.passed);
      if (failedAssertions.length > 0) {
        const examples = failedAssertions
          .slice(0, 2)
          .map((a) => `"${a.description}"`)
          .join(", ");
        return `Review the specific failed assertions: ${examples}. Check if the expected state matches what's actually visible on the page.`;
      }
      return "Review all assertions carefully. Ensure the page is in the expected state before validation.";
    }

    case "test_definition_issue":
      return "The test may have incomplete steps or missing assertions. Review the test definition for clarity and completeness.";

    default:
      return "Review the full error message and agent output to understand what went wrong. Try breaking down complex steps into smaller actions.";
  }
}

/**
 * Builds detailed analysis of what happened.
 */
function buildAnalysis(
  result: TestCaseResult,
  category: FailureCategory,
): string {
  const parts: string[] = [];

  parts.push(`Test failed with status: ${result.status}.`);

  if (result.error) {
    parts.push(`Error: ${result.error}`);
  }

  if (category === "assertion_mismatch" && result.assertions.length > 0) {
    const failedCount = result.assertions.filter((a) => !a.passed).length;
    parts.push(
      `${failedCount} of ${result.assertions.length} assertions failed.`,
    );
  }

  if (result.validationOutput) {
    const validationSnippet = result.validationOutput.substring(0, 200);
    parts.push(
      `Validation: ${validationSnippet}${result.validationOutput.length > 200 ? "..." : ""}`,
    );
  }

  return parts.join(" ");
}

/**
 * Builds a one-line failure reason summary.
 */
function buildFailureReason(
  result: TestCaseResult,
  category: FailureCategory,
): string {
  switch (category) {
    case "navigation_error":
      return "Page failed to load or navigate correctly";
    case "element_not_found":
      return "Required element not found on page";
    case "timing_issue":
      return "Page elements not ready in time";
    case "popup_overlay":
      return "Popup or overlay blocked interaction";
    case "assertion_mismatch": {
      const failedCount = result.assertions.filter((a) => !a.passed).length;
      return `${failedCount} assertion(s) failed`;
    }
    case "test_definition_issue":
      return "Test definition incomplete or unclear";
    default:
      return result.error || "Test failed for unknown reason";
  }
}

/**
 * Attempts to extract which step failed from the agent output.
 */
function extractFailedStep(result: TestCaseResult): number | undefined {
  const output = result.agentOutput || "";

  // Look for patterns like "Step 3:", "CURRENT STEP: 5", etc.
  const stepPatterns = [
    /step\s+(\d+)/i,
    /current step:\s*(\d+)/i,
    /executing step\s+(\d+)/i,
  ];

  for (const pattern of stepPatterns) {
    const match = output.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  return undefined;
}
