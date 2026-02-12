import { config } from '../config/index.js';
import { getEvalDataset } from './dataset.js';
import { runTestSuite } from '../tests/runner.js';
import { runStore } from '../memory/run-store.js';

async function main() {
  console.log('🚀 Starting QA Agent Evaluation...');
  
  const testCases = await getEvalDataset();
  if (testCases.length === 0) {
    console.log('No evaluation test cases found.');
    process.exit(0);
  }

  console.log(`Evaluating on ${testCases.length} test cases...`);
  
  const suite = {
    name: 'Evaluation Suite',
    testCases
  };

  try {
    const result = await runTestSuite(suite, config);
    runStore.saveRun(result);

    console.log('\n--- EVALUATION RESULTS ---');
    console.log(`Total: ${result.summary.total}`);
    console.log(`Passed: ${result.summary.passed}`);
    console.log(`Failed: ${result.summary.failed}`);
    console.log(`Success Rate: ${((result.summary.passed / result.summary.total) * 100).toFixed(2)}%`);
    
    // Exit with 1 if any test failed
    process.exit(result.summary.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Evaluation failed:', error);
    process.exit(1);
  }
}

main();
