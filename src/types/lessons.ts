export type FailureCategory =
  | "navigation_error"
  | "element_not_found"
  | "timing_issue"
  | "popup_overlay"
  | "assertion_mismatch"
  | "test_definition_issue"
  | "unknown";

export interface FailureLesson {
  testId: string;
  runId: string;
  timestamp: string;
  failureReason: string; // one-line summary
  failureCategory: FailureCategory;
  analysis: string; // what happened
  advice: string; // what to try differently
  failedStep?: number;
  consecutiveFailures: number;
  resolved: boolean; // true when test later passes
}

export type CorrectionType =
  | "update_assertion"
  | "update_step"
  | "update_expected_outcome"
  | "update_url";

export type CorrectionSection =
  | "assertions"
  | "steps"
  | "expected_outcome"
  | "metadata";

export interface TestCorrection {
  testId: string;
  filePath: string;
  timestamp: string;
  correctionType: CorrectionType;
  description: string;
  section: CorrectionSection;
  originalContent: string;
  suggestedContent: string;
  applied: boolean;
}
