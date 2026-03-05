export interface ModelConfig {
  navigator: string;
  validator: string;
  reporter: string;
  evaluator: string;
}

export interface BugReport {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: "functional" | "visual" | "seo" | "accessibility" | "translation";
  title: string;
  description: string;
  url: string;
  viewport: string;
  steps: string[];
  expected: string;
  actual: string;
  screenshots: string[];
  timestamp: string;
}

export interface AssertionResult {
  description: string;
  passed: boolean;
  evidence?: string;
  timestamp: string;
}

export interface EvaluationResult {
  confidence: number;
  override: string | null;
  reason: string;
}

export interface TestCaseResult {
  testId: string;
  title: string;
  status: "passed" | "failed" | "inconclusive" | "error";
  statusReason: string;
  duration: number;
  bugs: BugReport[];
  assertions: AssertionResult[];
  screenshots: string[];
  agentOutput: string;
  validationOutput?: string;
  evaluationResult?: EvaluationResult;
  error?: string;
}

export interface TestRunResult {
  runId: string;
  timestamp: string;
  gitCommit?: string;
  modelConfig?: ModelConfig;
  results: TestCaseResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    inconclusive: number;
    errors: number;
    duration: number;
  };
}

export interface RegressionReport {
  timestamp: string;
  previousRunId?: string;
  currentRunId: string;
  regressions: {
    testId: string;
    title: string;
    previousStatus: string;
    currentStatus: string;
    details: string;
  }[];
  improvements: {
    testId: string;
    title: string;
    previousStatus: string;
    currentStatus: string;
  }[];
}
