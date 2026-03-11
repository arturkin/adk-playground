export interface TestStep {
  index: number;
  instruction: string;
  assertions?: TestAssertion[];
}

export interface TestAssertion {
  description: string;
  passed?: boolean;
  evidence?: string;
}

export interface TestCase {
  id: string;
  title: string;
  filePath: string;
  url: string;
  viewport: string;
  tags: string[];
  priority: "low" | "medium" | "high" | "critical";
  steps: TestStep[];
  expectedOutcome: string;
  assertions: TestAssertion[];
}

export interface TestSuite {
  name: string;
  testCases: TestCase[];
}
