import { TestCase } from '../types/test.js';
import { parseTestCase } from '../tests/parser.js';
import path from 'path';
import fs from 'fs';

/**
 * Returns the dataset for evaluation.
 * It discovers markdown files in the tests/ directory.
 */
export async function getEvalDataset(): Promise<TestCase[]> {
  const testDir = path.resolve(process.cwd(), 'tests');
  if (!fs.existsSync(testDir)) {
    return [];
  }

  const files = fs.readdirSync(testDir).filter(f => f.endsWith('.md'));
  return files.map(f => parseTestCase(path.join(testDir, f)));
}
