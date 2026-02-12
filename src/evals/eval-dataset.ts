import { EvalCase } from './eval-types.js';
import path from 'path';

export function getEvalDataset(): EvalCase[] {
  const testsDir = path.resolve(process.cwd(), 'tests');
  const negativeDir = path.join(testsDir, 'negative');

  return [
    // Positive Tests
    {
      testFilePath: path.join(testsDir, 'search-tour.md'),
      expectedStatus: 'passed'
    },
    {
      testFilePath: path.join(testsDir, 'search-car-rental.md'),
      expectedStatus: 'passed'
    },
    // Negative Tests
    {
      testFilePath: path.join(negativeDir, 'wrong-url-tour.md'),
      expectedStatus: 'failed'
    },
    {
      testFilePath: path.join(negativeDir, 'impossible-element.md'),
      expectedStatus: 'failed'
    },
    {
      testFilePath: path.join(negativeDir, 'wrong-content-assertion.md'),
      expectedStatus: 'failed'
    },
    {
      testFilePath: path.join(negativeDir, 'missing-search-results.md'),
      expectedStatus: 'failed'
    }
  ];
}
