import { Command } from 'commander';
import { config } from './config/index.js';
import { createRunner } from './agents/index.js';
import { getBrowserManager } from './browser/index.js';
import { discoverTests } from './tests/discovery.js';
import { runTestSuite, runTestCase } from './tests/runner.js';
import { parseTestCase } from './tests/parser.js';
import { getFunctionCalls, stringifyContent } from '@google/adk';

const program = new Command();

program
  .name('adk-qa')
  .description('AI-powered QA automation tool')
  .version('0.1.0');

program
  .command('manual')
  .description('Run a manual QA task')
  .argument('<task>', 'Description of the QA task to perform')
  .option('--url <url>', 'Initial URL to start from')
  .action(async (task, options) => {
    if (!config.apiKey) {
      console.error('Error: GOOGLE_GENAI_API_KEY is not set.');
      process.exit(1);
    }

    console.log(`Starting manual QA task: "${task}"`);
    if (options.url) console.log(`Starting URL: ${options.url}`);

    const runner = createRunner(config);
    const browser = getBrowserManager();

    try {
      await browser.launch(config.headless);

      const session = await runner.sessionService.createSession({
        appName: 'adk-qa',
        userId: 'cli',
        state: { 
          task_steps: task,
          url_hint: options.url || '',
          expected_criteria: 'Task completed successfully'
        }
      });

      console.log(`Session created: ${session.id}`);

      for await (const event of runner.runAsync({
        userId: 'cli',
        sessionId: session.id,
        newMessage: { role: 'user', parts: [{ text: 'Begin QA task' }] },
      })) {
        if (event.author && event.author !== 'user') {
          const text = stringifyContent(event);
          if (text) {
            console.log(`\x1b[36m[Agent: ${event.author}]\x1b[0m ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
          }
          
          const functionCalls = getFunctionCalls(event);
          for (const call of functionCalls) {
            console.log(`  \x1b[33m[Tool: ${call.name}] calling with: ${JSON.stringify(call.args)}\x1b[0m`);
          }
        }
      }

      const sessionDetails = await runner.sessionService.getSession({ 
        appName: 'adk-qa',
        userId: 'cli',
        sessionId: session.id 
      });
      const finalReport = sessionDetails?.state?.['final_report'];
      console.log('\n\x1b[1m--- FINAL REPORT ---\x1b[0m');
      console.log(typeof finalReport === 'string' ? finalReport : 'No report generated.');

    } catch (error) {
      console.error('Task failed:', error);
    } finally {
      // Wait for a few seconds if not headless to see the last state
      if (!config.headless) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      await browser.close();
    }
  });

program
  .command('auto')
  .description('Run automated test suites')
  .option('--test-dir <dir>', 'Directory containing test files', config.testDir)
  .option('--test-file <file>', 'Specific test file to run')
  .action(async (options) => {
    if (!config.apiKey) {
      console.error('Error: GOOGLE_GENAI_API_KEY is not set.');
      process.exit(1);
    }

    let suite;
    if (options.testFile) {
      console.log(`Running single test file: ${options.testFile}`);
      try {
        const testCase = parseTestCase(options.testFile);
        suite = { name: 'Single Test', testCases: [testCase] };
      } catch (e) {
        console.error(`Failed to parse test file: ${(e as Error).message}`);
        process.exit(1);
      }
    } else {
      console.log(`Discovering tests in: ${options.testDir}`);
      suite = await discoverTests(options.testDir);
    }

    if (suite.testCases.length === 0) {
      console.log('No tests found.');
      process.exit(0);
    }

    console.log(`Found ${suite.testCases.length} tests. Starting execution...`);
    
    try {
      const runResult = await runTestSuite(suite, config);
      
      console.log('\n\x1b[1m--- TEST RUN SUMMARY ---\x1b[0m');
      console.log(`Run ID: ${runResult.runId}`);
      console.log(`Total: ${runResult.summary.total}`);
      console.log(`Passed: \x1b[32m${runResult.summary.passed}\x1b[0m`);
      console.log(`Failed: \x1b[31m${runResult.summary.failed}\x1b[0m`);
      console.log(`Duration: ${(runResult.summary.duration / 1000).toFixed(2)}s`);
      
      process.exit(runResult.summary.failed > 0 ? 1 : 0);
    } catch (error) {
      console.error('Test run failed:', error);
      process.exit(1);
    }
  });

program.parse();
