export interface EvalCase {
  testFilePath: string;
  expectedStatus: 'passed' | 'failed';
}

export interface EvalResult {
  testId: string;
  title: string;
  expectedStatus: 'passed' | 'failed';
  actualStatus: 'passed' | 'failed' | 'inconclusive' | 'error';
  isCorrect: boolean;
}

export interface EvalRunResult {
  total: number;
  correct: number;
  accuracy: number;
  falsePositives: number; // Expected FAIL, got PASS
  falseNegatives: number; // Expected PASS, got FAIL
  results: EvalResult[];
}
