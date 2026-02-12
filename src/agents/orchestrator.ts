import { BaseAgent, type InvocationContext, type Event } from '@google/adk';
import { type AppConfig } from '../config/schema.js';
import { buildNavigatorAgent } from './navigator.js';
import { buildValidatorAgent } from './validator.js';
import { buildReporterAgent } from './reporter.js';

/**
 * Orchestrates the QA flow: Navigator -> Validator -> Reporter.
 * This agent is deterministic and doesn't use an LLM for its own logic.
 */
export class OrchestratorAgent extends BaseAgent {
  private navigatorLoop;
  private validator;
  private reporter;

  constructor(config: AppConfig) {
    super({ name: 'orchestrator' });
    this.navigatorLoop = buildNavigatorAgent(config);
    this.validator = buildValidatorAgent(config);
    this.reporter = buildReporterAgent(config);
  }

  async *runAsyncImpl(ctx: InvocationContext): AsyncGenerator<Event> {
    // Phase 1: Navigate and interact
    for await (const event of this.navigatorLoop.runAsync(ctx)) {
      yield event;
    }

    // Phase 2: Validate outcomes
    for await (const event of this.validator.runAsync(ctx)) {
      yield event;
    }

    // Phase 3: Generate report
    for await (const event of this.reporter.runAsync(ctx)) {
      yield event;
    }
  }

  protected async *runLiveImpl(ctx: InvocationContext): AsyncGenerator<Event> {
    throw new Error('runLive is not supported for OrchestratorAgent');
  }
}
