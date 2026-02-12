import { Command } from 'commander';
import { config } from './config/index.js';
import { createRunner } from './agents/index.js';
import { getBrowserManager } from './browser/index.js';

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
          url_hint: options.url || ''
        }
      });

      console.log(`Session created: ${session.id}`);

      for await (const event of runner.runAsync({
        userId: 'cli',
        sessionId: session.id,
        newMessage: { role: 'user', parts: [{ text: 'Begin QA task' }] },
      })) {
        const anyEvent = event as any;
        if (anyEvent.type === 'agent_start') {
          console.log(`\x1b[36m[Agent: ${anyEvent.agentName}] Starting...\x1b[0m`);
        } else if (anyEvent.type === 'tool_call') {
          console.log(`  \x1b[33m[Tool: ${anyEvent.toolName}] calling with: ${JSON.stringify(anyEvent.args)}\x1b[0m`);
        } else if (anyEvent.type === 'tool_response') {
          console.log(`  \x1b[32m[Tool: ${anyEvent.toolName}] responded: ${JSON.stringify(anyEvent.response).substring(0, 100)}...\x1b[0m`);
        } else if (anyEvent.type === 'agent_end') {
          console.log(`\x1b[34m[Agent: ${anyEvent.agentName}] finished.\x1b[0m`);
        } else if (anyEvent.type === 'error') {
          console.error(`\x1b[31m[Error] ${anyEvent.message}\x1b[0m`);
        }
      }

      const sessionDetails = (await runner.sessionService.getSession({ 
        appName: 'adk-qa',
        userId: 'cli',
        sessionId: session.id 
      })) as any;
      const finalReport = sessionDetails?.state?.get('final_report');
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
    console.log('Automated mode is not yet implemented (Task 6).');
    process.exit(0);
  });

program.parse();
