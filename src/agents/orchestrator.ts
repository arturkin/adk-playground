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
    const navigatorLoop = buildNavigatorAgent(config);
    const validator = buildValidatorAgent(config);
    const reporter = buildReporterAgent(config);
    super({ 
      name: 'orchestrator',
      subAgents: [navigatorLoop, validator, reporter]
    });
    this.navigatorLoop = navigatorLoop;
    this.validator = validator;
    this.reporter = reporter;
  }

  async *runAsyncImpl(ctx: InvocationContext): AsyncGenerator<Event> {
    // Phase 1: Navigate and interact
    for await (const event of this.navigatorLoop.runAsync(ctx)) {
      if (event.actions?.stateDelta) {
        Object.assign(ctx.session.state, event.actions.stateDelta);
      }
      yield event;
    }

    // Phase 2: Validate outcomes
    for await (const event of this.validator.runAsync(ctx)) {
      if (event.actions?.stateDelta) {
        Object.assign(ctx.session.state, event.actions.stateDelta);
      }
      yield event;
    }

    // Phase 3: Generate report
    for await (const event of this.reporter.runAsync(ctx)) {
      if (event.actions?.stateDelta) {
        Object.assign(ctx.session.state, event.actions.stateDelta);
      }
      yield event;
    }
  }

  // OrchestratorAgent is deterministic and doesn't need to implement runLiveImpl
  protected async *runLiveImpl(ctx: InvocationContext): AsyncGenerator<Event> {
    yield* this.runAsyncImpl(ctx);
  }
}
