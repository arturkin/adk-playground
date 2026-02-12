import { TestRunResult, RegressionReport, TestCaseResult } from '../types/report.js';

/**
 * Compares two test runs to detect regressions and improvements.
 */
export function detectRegressions(current: TestRunResult, previous: TestRunResult | null): RegressionReport {
  const report: RegressionReport = {
    timestamp: new Date().toISOString(),
    previousRunId: previous?.runId,
    currentRunId: current.runId,
    regressions: [],
    improvements: [],
  };

  if (!previous) {
    return report;
  }

  const previousResultsMap = new Map<string, TestCaseResult>();
  previous.results.forEach(r => previousResultsMap.set(r.testId, r));

  current.results.forEach(currentResult => {
    const previousResult = previousResultsMap.get(currentResult.testId);
    
    if (previousResult) {
      // Regression: passed -> failed
      if (previousResult.status === 'passed' && (currentResult.status === 'failed' || currentResult.status === 'error')) {
        report.regressions.push({
          testId: currentResult.testId,
          title: currentResult.title,
          previousStatus: previousResult.status,
          currentStatus: currentResult.status,
          details: currentResult.error || (currentResult.bugs.length > 0 ? `${currentResult.bugs.length} bugs found` : 'Test failed'),
        });
      }
      
      // Improvement: failed/error -> passed
      if ((previousResult.status === 'failed' || previousResult.status === 'error') && currentResult.status === 'passed') {
        report.improvements.push({
          testId: currentResult.testId,
          title: currentResult.title,
          previousStatus: previousResult.status,
          currentStatus: currentResult.status,
        });
      }
    }
  });

  return report;
}
