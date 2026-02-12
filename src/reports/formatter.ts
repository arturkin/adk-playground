import { TestRunResult, RegressionReport } from '../types/report.js';

/**
 * Formats test run results and regression reports into Markdown.
 */
export function formatMarkdownReport(run: TestRunResult, regression?: RegressionReport): string {
  let md = `# QA Test Run Report\n\n`;

  md += `## Summary\n`;
  md += `- **Run ID**: ${run.runId}\n`;
  md += `- **Timestamp**: ${run.timestamp}\n`;
  if (run.gitCommit) md += `- **Git Commit**: \`${run.gitCommit}\`\n`;
  md += `- **Total Tests**: ${run.summary.total}\n`;
  md += `- **Passed**: ${run.summary.passed}\n`;
  md += `- **Failed**: ${run.summary.failed}\n`;
  if (run.summary.inconclusive > 0) md += `- **Inconclusive**: ${run.summary.inconclusive}\n`;
  if (run.summary.errors > 0) md += `- **Errors**: ${run.summary.errors}\n`;
  md += `- **Duration**: ${(run.summary.duration / 1000).toFixed(2)}s\n\n`;

  if (regression && (regression.regressions.length > 0 || regression.improvements.length > 0)) {
    md += `## Regressions & Improvements\n`;

    if (regression.regressions.length > 0) {
      md += `### ⚠️ Regressions\n`;
      regression.regressions.forEach(r => {
        md += `- **${r.title}**: ${r.previousStatus} -> ${r.currentStatus}\n`;
        md += `  - Details: ${r.details}\n`;
      });
      md += `\n`;
    }

    if (regression.improvements.length > 0) {
      md += `### ✨ Improvements\n`;
      regression.improvements.forEach(i => {
        md += `- **${i.title}**: ${i.previousStatus} -> ${i.currentStatus}\n`;
      });
      md += `\n`;
    }
  }

  const testsWithDetails = run.results.filter(r =>
    r.status === 'failed' ||
    r.status === 'error' ||
    (r.assertions && r.assertions.length > 0) ||
    (r.bugs && r.bugs.length > 0)
  );

  if (testsWithDetails.length > 0) {
    md += `## Test Details\n\n`;
    testsWithDetails.forEach(test => {
      const statusEmoji = test.status === 'passed' ? '✅' : (test.status === 'failed' || test.status === 'error' ? '❌' : '❓');
      md += `### ${statusEmoji} ${test.title} (${test.status.toUpperCase()})\n`;
      md += `- **Test ID**: \`${test.testId}\`\n`;
      md += `- **Duration**: ${(test.duration / 1000).toFixed(2)}s\n`;
      if (test.error) md += `- **Error**: \`${test.error}\`\n`;

      if (test.assertions && test.assertions.length > 0) {
        md += `#### Assertions\n`;
        md += `| Status | Description | Evidence |\n`;
        md += `|--------|-------------|----------|\n`;
        test.assertions.forEach(a => {
          const passEmoji = a.passed ? '✅' : '❌';
          md += `| ${passEmoji} | ${a.description} | ${a.evidence || '-'} |\n`;
        });
        md += `\n`;
      }

      if (test.bugs && test.bugs.length > 0) {
        md += `#### Detected Bugs\n`;
        test.bugs.forEach(bug => {
          md += `##### ${bug.title} (${bug.severity.toUpperCase()})\n`;
          md += `- **Category**: ${bug.category}\n`;
          md += `- **Description**: ${bug.description}\n`;
          md += `- **Expected**: ${bug.expected}\n`;
          md += `- **Actual**: ${bug.actual}\n`;
          md += `- **URL**: ${bug.url}\n`;
          if (bug.screenshots.length > 0) {
            md += `- **Screenshots**: ${bug.screenshots.join(', ')}\n`;
          }
          md += `\n`;
        });
      }

      if (test.validationOutput) {
        md += `#### Validation Output\n<details><summary>Click to expand</summary>\n\n${test.validationOutput}\n\n</details>\n\n`;
      }

      md += `#### Reporter Output\n<details><summary>Click to expand</summary>\n\n${test.agentOutput}\n\n</details>\n\n`;
    });
  }

  md += `## All Results\n`;
  md += `| Test Title | Status | Duration | Bugs |\n`;
  md += `|------------|--------|----------|------|\n`;
  run.results.forEach(r => {
    const statusEmoji = r.status === 'passed' ? '✅' : (r.status === 'failed' || r.status === 'error' ? '❌' : '❓');
    md += `| ${r.title} | ${statusEmoji} ${r.status} | ${(r.duration / 1000).toFixed(2)}s | ${r.bugs.length} |\n`;
  });

  return md;
}
