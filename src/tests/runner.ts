import { createRunner } from '../agents/index.js';
import { getBrowserManager } from '../browser/index.js';
import { type AppConfig } from '../config/schema.js';
import { TestCase, TestSuite } from '../types/test.js';
import { TestRunResult, TestCaseResult, BugReport } from '../types/report.js';
import { runStore } from '../memory/index.js';
import { loadKnowledgeBase } from './discovery.js';
import { getFunctionCalls, stringifyContent } from '@google/adk';
import { execSync } from 'child_process';

/**
 * Executes a single test case using the multi-agent orchestrator.
 */
export async function runTestCase(testCase: TestCase, config: AppConfig, runner: ReturnType<typeof createRunner>, runId: string): Promise<TestCaseResult> {
  const startTime = Date.now();
  console.log(`\x1b[1mRunning Test: ${testCase.title}\x1b[0m`);

  // Try to find viewport preset
  const viewport = config.viewports.find(v => v.name === testCase.viewport) || config.viewports[0];
  const browser = getBrowserManager(viewport);

    const knowledgeBase = await loadKnowledgeBase(config.knowledgeBaseDir);

  try {
    // We launch browser for each test to ensure clean state
    await browser.launch(config.headless);

    const formattedSteps = testCase.steps.map(s => `${s.index}. ${s.instruction}`).join('\n');

    const session = await runner.sessionService.createSession({
      appName: 'adk-qa',
      userId: 'test-runner',
      state: {
        task_steps: formattedSteps,
        url_hint: testCase.url,
        expected_criteria: testCase.expectedOutcome,
        current_viewport: testCase.viewport,
        knowledge_base: knowledgeBase,
        assertion_count: String(testCase.assertions.length),
        test_assertions: `You MUST call record_assertion exactly ${testCase.assertions.length} time(s) — one for each assertion:\n` +
          testCase.assertions.map((a, i) =>
            `- Assertion ID ${i + 1}: "${a.description}"`
          ).join('\n'),
        // Parallel JSON format for the record_assertion tool to look up originals
        _test_assertions_json: JSON.stringify(
          testCase.assertions.map((a, i) => ({
            id: i + 1,
            description: a.description,
          }))
        ),
      }
    });

    for await (const event of runner.runAsync({
      userId: 'test-runner',
      sessionId: session.id,
      newMessage: {
        role: 'user',
        parts: [{
          text: `Execute Automated Test: ${testCase.title}\n` +
                `Target URL: ${testCase.url}\n` +
                `Steps:\n${formattedSteps}`
        }]
      },
    })) {
      if (event.author && event.author !== 'user') {
        const text = stringifyContent(event);
        if (text) {
          console.log(`  \x1b[36m[Agent: ${event.author}]\x1b[0m ${text.substring(0, 500)}${text.length > 500 ? '...' : ''}`);
        }

        const functionCalls = getFunctionCalls(event);
        for (const call of functionCalls) {
          console.log(`    \x1b[33m[Tool: ${call.name}] calling...\x1b[0m`);
        }
      }
    }

    const sessionDetails = await runner.sessionService.getSession({
      appName: 'adk-qa',
      userId: 'test-runner',
      sessionId: session.id
    });

    const validationResult = (sessionDetails?.state?.['validation_result'] as string) || '';
    const finalReport = (sessionDetails?.state?.['final_report'] as string) || '';
    const bugsJson = (sessionDetails?.state?.['bugs'] as string) || '[]';
    const latestScreenshot = (sessionDetails?.state?.['latest_screenshot'] as string) || '';
    const assertionsJson = (sessionDetails?.state?.['assertions'] as string) || '[]';
    const assertions = JSON.parse(assertionsJson);

    const bugs: BugReport[] = JSON.parse(bugsJson);

    // Save the latest screenshot if it exists
    const screenshotFiles: string[] = [];
    if (latestScreenshot) {
      const filename = `screenshot_${Date.now()}.png`;
      runStore.saveScreenshot(runId, filename, latestScreenshot);
      screenshotFiles.push(filename);
    }

    let status: 'passed' | 'failed' | 'inconclusive' | 'error';
    // Signal 1: validation_result text
    const validationVerdict = validationResult.toUpperCase();
    const validatorSaysPass = validationVerdict.includes('PASS') && !validationVerdict.includes('FAIL');
    const validatorSaysFail = validationVerdict.includes('FAIL');

    // Signal 2: recorded assertions
    const hasAssertions = assertions.length > 0;
    const allAssertionsPassed = hasAssertions && assertions.every((a: any) => {
      const original = testCase.assertions[a.id - 1];
      if (!original) return false;
      // Allow minor differences in whitespace or case, but otherwise must match
      return a.passed === true && a.description.trim().toLowerCase() === original.description.trim().toLowerCase();
    });
    const anyAssertionFailed = hasAssertions && (
      assertions.some((a: any) => a.passed === false) ||
      assertions.length < testCase.assertions.length // Missing assertions count as failed
    );

    // Signal 3: bugs found (structural safeguard)
    const hasSeriousBugs = bugs.some((b: BugReport) =>
      ['critical', 'high', 'medium'].includes(b.severity)
    );

    // Signal 4: test expects assertions but none were recorded
    const expectedAssertionCount = testCase.assertions.length;
    const noAssertionsRecorded = expectedAssertionCount > 0 && assertions.length === 0;

    // Decision logic with structural safeguards
    if (validatorSaysFail || anyAssertionFailed) {
      status = 'failed';
    } else if (hasSeriousBugs) {
      status = 'failed';
    } else if (noAssertionsRecorded) {
      // Test expects assertions but validator recorded none - cannot confirm pass
      status = 'failed';
    } else if (validatorSaysPass && (!hasAssertions || allAssertionsPassed)) {
      status = 'passed';
    } else if (hasAssertions && allAssertionsPassed) {
      status = 'passed';
    } else if (!validationResult && !hasAssertions) {
      status = 'inconclusive';
    } else {
      status = 'inconclusive';
    }

    return {
      testId: testCase.id,
      title: testCase.title,
      status,
      duration: Date.now() - startTime,
      bugs,
      assertions,
      screenshots: screenshotFiles,
      agentOutput: finalReport,
      validationOutput: validationResult,
    };
  } catch (error) {
    console.error(`Test failed with error: ${(error as Error).message}`);
    return {
      testId: testCase.id,
      title: testCase.title,
      status: 'error',
      duration: Date.now() - startTime,
      bugs: [],
      assertions: [],
      screenshots: [],
      agentOutput: '',
      error: (error as Error).message,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Executes a whole test suite.
 */
export async function runTestSuite(suite: TestSuite, config: AppConfig): Promise<TestRunResult> {
  const startTime = Date.now();
  const runId = `run-${Date.now()}`;
  const results: TestCaseResult[] = [];
  const runner = createRunner(config);

  for (const testCase of suite.testCases) {
    const result = await runTestCase(testCase, config, runner, runId);
    results.push(result);
  }

  const duration = Date.now() - startTime;
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const inconclusive = results.filter(r => r.status === 'inconclusive').length;
  const errors = results.filter(r => r.status === 'error').length;

  let gitCommit: string | undefined;
  try {
    gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch (e) {
    // Ignore if not a git repo
  }

  return {
    runId,
    timestamp: new Date().toISOString(),
    gitCommit,
    results,
    summary: {
      total: suite.testCases.length,
      passed,
      failed,
      inconclusive,
      errors,
      duration,
    },
  };
}
