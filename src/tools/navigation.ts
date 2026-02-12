import { FunctionTool, type ToolContext } from '@google/adk';
import { z } from 'zod';
import { getBrowserManager, navigateTo, scrollPage } from '../browser/index.js';
import { captureBrowserState } from './_helpers.js';


const paramsSchema = z.object({
  url: z.string().url().describe('The URL to navigate to'),
});

export const navigateTool = new FunctionTool({
  name: 'navigate',
  description: 'Navigates the browser to a specific URL and captures a screenshot.',
  // @google/adk FunctionTool typing requires 'as any' for the schema if using Zod
  parameters: paramsSchema as any,
  execute: async ({ url }: any, toolContext) => {
    if (!toolContext) throw new Error('ToolContext is required');
    try {
      await navigateTo(url);
      toolContext.state.set('current_url', url);
      const elementCount = await captureBrowserState(toolContext);
      return {
        status: 'success',
        message: `Navigated to ${url}`,
        elementCount,
      };
    } catch (e) {
      return {
        status: 'error',
        message: `Failed to navigate to ${url}: ${(e as Error).message}`,
      };
    }
  },
});

const scrollParamsSchema = z.object({
  direction: z.enum(['up', 'down', 'top', 'bottom']).describe('The direction to scroll'),
});

export const scrollTool = new FunctionTool({
  name: 'scroll',
  description: 'Scrolls the page in a direction. Only use this if the element you need is NOT in the current element list.',
  // @google/adk FunctionTool typing requires 'as any' for the schema if using Zod
  parameters: scrollParamsSchema as any,
  execute: async ({ direction }: any, toolContext) => {
    if (!toolContext) throw new Error('ToolContext is required');
    try {
      await scrollPage(direction);
      const elementCount = await captureBrowserState(toolContext);
      return {
        status: 'success',
        message: `Scrolled ${direction}`,
        elementCount,
      };
    } catch (e) {
      return {
        status: 'error',
        message: `Failed to scroll ${direction}: ${(e as Error).message}`,
      };
    }
  },
});
