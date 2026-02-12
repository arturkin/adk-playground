import { glob } from 'glob';
import { parseTestCase } from './parser.js';
import { TestSuite } from '../types/test.js';
import fs from 'fs';
import path from 'path';

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

/**
 * Loads all knowledge base files from the specified directory.
 */
export async function loadKnowledgeBase(kbDir: string): Promise<string> {
  if (!fs.existsSync(kbDir)) {
    return 'No knowledge base available.';
  }

  const files = await glob(`${kbDir}/**/*.md`);
  if (files.length === 0) {
    return 'No knowledge base files found.';
  }

  let fullContent = 'KNOWLEDGE BASE:\n\n';
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const filename = path.basename(file);
    fullContent += `--- FILE: ${filename} ---\n${content}\n\n`;
  }

  return fullContent;
}
