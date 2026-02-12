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
    yield* this.navigatorLoop.runAsync(ctx);

    // Phase 2: Validate outcomes
    yield* this.validator.runAsync(ctx);

    // Phase 3: Generate report
    yield* this.reporter.runAsync(ctx);
  }

  // OrchestratorAgent is deterministic and doesn't need to implement runLiveImpl
  protected async *runLiveImpl(ctx: InvocationContext): AsyncGenerator<Event> {
    yield* this.runAsyncImpl(ctx);
  }
}
