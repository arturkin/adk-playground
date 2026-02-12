import { createRunner } from '../agents/index.js';
import { getBrowserManager } from '../browser/index.js';
import { type AppConfig } from '../config/schema.js';
import { TestCase, TestSuite } from '../types/test.js';
import { TestRunResult, TestCaseResult, BugReport } from '../types/report.js';

/**
 * Executes a single test case using the multi-agent orchestrator.
 */
export async function runTestCase(testCase: TestCase, config: AppConfig): Promise<TestCaseResult> {
  const startTime = Date.now();
  console.log(`\x1b[1mRunning Test: ${testCase.title}\x1b[0m`);

  const runner = createRunner(config);
  const browser = getBrowserManager();

  // Try to find viewport preset
  const viewport = config.viewports.find(v => v.name === testCase.viewport) || config.viewports[0];
  
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
      const anyEvent = event as any;
      if (anyEvent.type === 'agent_start') {
        console.log(`  \x1b[36m[Agent: ${anyEvent.agentName}] Starting...\x1b[0m`);
      } else if (anyEvent.type === 'tool_call') {
        console.log(`    \x1b[33m[Tool: ${anyEvent.toolName}] calling...\x1b[0m`);
      } else if (anyEvent.type === 'error') {
        console.error(`  \x1b[31m[Error] ${anyEvent.message}\x1b[0m`);
      }
    }

    const sessionDetails = (await runner.sessionService.getSession({ 
      appName: 'adk-qa',
      userId: 'test-runner',
      sessionId: session.id 
    })) as any;

    const validationResult = sessionDetails?.state?.get('validation_result') || '';
    const finalReport = sessionDetails?.state?.get('final_report') || '';
    const bugsJson = sessionDetails?.state?.get('temp:bugs') || '[]';
    const bugs: BugReport[] = JSON.parse(bugsJson);
    
    const status = validationResult.toUpperCase().includes('PASS') ? 'passed' : 
                   validationResult.toUpperCase().includes('FAIL') ? 'failed' : 'inconclusive';

    return {
      testId: testCase.id,
      title: testCase.title,
      status,
      duration: Date.now() - startTime,
      bugs,
      screenshots: [], // To be populated in Task 7/8
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
  const results: TestCaseResult[] = [];

  for (const testCase of suite.testCases) {
    const result = await runTestCase(testCase, config);
    results.push(result);
  }

  const duration = Date.now() - startTime;
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed' || r.status === 'error').length;

  return {
    runId: `run-${Date.now()}`,
    timestamp: new Date().toISOString(),
    results,
    summary: {
      total: suite.testCases.length,
      passed,
      failed,
      duration,
    },
  };
}
