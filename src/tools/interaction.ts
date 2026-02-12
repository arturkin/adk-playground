import { FunctionTool, type ToolContext } from '@google/adk';
import { z } from 'zod';
import { clickElement, typeElement, pressKey, hoverElement, getBrowserManager } from '../browser/index.js';
import { captureBrowserState } from './_helpers.js';

/**
 * Looks up the element metadata from latest_elements state by ID.
 */
function getElementMeta(toolContext: ToolContext, id: number): any {
  try {
    const elements = JSON.parse(toolContext.state.get('latest_elements') as string || '[]');
    return elements.find((el: any) => el.id === id) || null;
  } catch {
    return null;
  }
}

const clickParamsSchema = z.object({
  id: z.number().describe('The visual ID of the element to click'),
});

export const clickElementTool = new FunctionTool({
  name: 'click_element',
  description: 'Clicks on an element using its visual ID and captures a screenshot.',
  // @google/adk FunctionTool typing requires 'as any' for the schema if using Zod
  parameters: clickParamsSchema as any,
  execute: async ({ id }: any, toolContext) => {
    if (!toolContext) throw new Error('ToolContext is required');
    try {
      const elMeta = getElementMeta(toolContext, id);
      await clickElement(id);
      const elementCount = await captureBrowserState(toolContext);
      const page = getBrowserManager().getPage();
      return {
        status: 'success',
        message: `Clicked element #${id}`,
        clickedElement: elMeta,
        currentUrl: page.url(),
        elementCount,
      };
    } catch (e) {
      return {
        status: 'error',
        message: `Failed to click element #${id}: ${(e as Error).message}`,
      };
    }
  },
});

export const hoverElementTool = new FunctionTool({
  name: 'hover_element',
  description: 'Hovers over an element using its visual ID and captures a screenshot.',
  parameters: clickParamsSchema as any, // Reuse clickParamsSchema as it also just needs an 'id'
  execute: async ({ id }: any, toolContext) => {
    if (!toolContext) throw new Error('ToolContext is required');
    try {
      await hoverElement(id);
      const elementCount = await captureBrowserState(toolContext);
      return {
        status: 'success',
        message: `Hovered over element #${id}`,
        elementCount,
      };
    } catch (e) {
      return {
        status: 'error',
        message: `Failed to hover over element #${id}: ${(e as Error).message}`,
      };
    }
  },
});

const typeParamsSchema = z.object({
  id: z.number().describe('The visual ID of the element to type into'),
  text: z.string().describe('The text to type'),
});

export const typeElementTool = new FunctionTool({
  name: 'type_element',
  description: 'Types text into an element using its visual ID and captures a screenshot.',
  // @google/adk FunctionTool typing requires 'as any' for the schema if using Zod
  parameters: typeParamsSchema as any,
  execute: async ({ id, text }: any, toolContext) => {
    if (!toolContext) throw new Error('ToolContext is required');
    try {
      await typeElement(id, text);
      const elementCount = await captureBrowserState(toolContext);
      return {
        status: 'success',
        message: `Typed into element #${id}`,
        elementCount,
      };
    } catch (e) {
      return {
        status: 'error',
        message: `Failed to type into element #${id}: ${(e as Error).message}`,
      };
    }
  },
});

const pressKeyParamsSchema = z.object({
  key: z.string().describe('The key to press (e.g., Enter, Tab, Escape)'),
});

export const pressKeyTool = new FunctionTool({
  name: 'press_key',
  description: 'Presses a keyboard key and captures a screenshot.',
  // @google/adk FunctionTool typing requires 'as any' for the schema if using Zod
  parameters: pressKeyParamsSchema as any,
  execute: async ({ key }: any, toolContext) => {
    if (!toolContext) throw new Error('ToolContext is required');
    try {
      await pressKey(key);
      const elementCount = await captureBrowserState(toolContext);
      return {
        status: 'success',
        message: `Pressed key: ${key}`,
        elementCount,
      };
    } catch (e) {
      return {
        status: 'error',
        message: `Failed to press key ${key}: ${(e as Error).message}`,
      };
    }
  },
});
