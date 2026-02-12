import { glob } from 'glob';
import { parseTestCase } from './parser.js';
import { TestSuite } from '../types/test.js';

/**
 * Discovers all markdown test files in the specified directory and parses them.
 */
export async function discoverTests(testDir: string): Promise<TestSuite> {
  const files = await glob(`${testDir}/**/*.md`);
  const testCases = files.map(file => parseTestCase(file));

  return {
    name: `Test Suite: ${testDir}`,
    testCases,
  };
}
