import { FunctionTool, type ToolContext } from '@google/adk';
import { z } from 'zod';

const bugParamsSchema = z.object({
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  category: z.enum(['functional', 'visual', 'seo', 'accessibility', 'translation']),
  title: z.string(),
  description: z.string(),
  expected: z.string(),
  actual: z.string(),
});

export const recordBugTool = new FunctionTool({
  name: 'record_bug',
  description: 'Records a bug finding during the QA process.',
  // @google/adk FunctionTool typing requires 'as any' for the schema if using Zod
  parameters: bugParamsSchema as any,
  execute: async (bug: any, toolContext) => {
    if (!toolContext) throw new Error('ToolContext is required');
    const bugs = JSON.parse(toolContext.state.get('bugs') || '[]');
    const bugReport = {
      ...bug,
      id: `BUG-${Date.now()}`,
      timestamp: new Date().toISOString(),
      url: toolContext.state.get('current_url') || 'unknown',
      viewport: toolContext.state.get('current_viewport') || 'desktop',
      steps: [],
      screenshots: [`screenshot_${Date.now()}`],
    };
    bugs.push(bugReport);
    toolContext.state.set('bugs', JSON.stringify(bugs));
    
    return {
      status: 'success',
      message: `Bug recorded: ${bug.title}`,
      bugId: bugReport.id,
    };
  },
});

const assertionParamsSchema = z.object({
  description: z.string(),
  passed: z.boolean(),
  evidence: z.string().optional(),
});

export const recordAssertionTool = new FunctionTool({
  name: 'record_assertion',
  description: 'Records a pass/fail assertion for a test step.',
  // @google/adk FunctionTool typing requires 'as any' for the schema if using Zod
  parameters: assertionParamsSchema as any,
  execute: async (assertion: any, toolContext) => {
    if (!toolContext) throw new Error('ToolContext is required');
    const assertions = JSON.parse(toolContext.state.get('assertions') || '[]');
    const record = {
      ...assertion,
      timestamp: new Date().toISOString(),
    };
    assertions.push(record);
    toolContext.state.set('assertions', JSON.stringify(assertions));
    
    return {
      status: 'success',
      message: `Assertion recorded: ${assertion.description} (${assertion.passed ? 'PASSED' : 'FAILED'})`,
    };
  },
});
