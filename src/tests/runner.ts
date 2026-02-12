import { createRunner } from '../agents/index.js';
import { getBrowserManager } from '../browser/index.js';
import { type AppConfig } from '../config/schema.js';
import { TestCase, TestSuite } from '../types/test.js';
import { TestRunResult, TestCaseResult, BugReport } from '../types/report.js';
import { runStore } from '../memory/index.js';
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
      }
    });

    for await (const event of runner.runAsync({
      userId: 'test-runner',
      sessionId: session.id,
      newMessage: { role: 'user', parts: [{ text: 'Begin Automated Test' }] },
    })) {
      if (event.author && event.author !== 'user') {
        const text = stringifyContent(event);
        if (text) {
          console.log(`  \x1b[36m[Agent: ${event.author}]\x1b[0m ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
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
    const bugs: BugReport[] = JSON.parse(bugsJson);

    // Save the latest screenshot if it exists
    const screenshotFiles: string[] = [];
    if (latestScreenshot) {
      const filename = `screenshot_${Date.now()}.png`;
      runStore.saveScreenshot(runId, filename, latestScreenshot);
      screenshotFiles.push(filename);
    }
    
    const status = validationResult.toUpperCase().includes('PASS') ? 'passed' : 
                   validationResult.toUpperCase().includes('FAIL') ? 'failed' : 'inconclusive';

    return {
      testId: testCase.id,
      title: testCase.title,
      status,
      duration: Date.now() - startTime,
      bugs,
      screenshots: screenshotFiles,
      agentOutput: finalReport,
    };
  } catch (error) {
    console.error(`Test failed with error: ${(error as Error).message}`);
    return {
      testId: testCase.id,
      title: testCase.title,
      status: 'error',
      duration: Date.now() - startTime,
      bugs: [],
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
  const failed = results.filter(r => r.status === 'failed' || r.status === 'error').length;

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
      duration,
    },
  };
}
