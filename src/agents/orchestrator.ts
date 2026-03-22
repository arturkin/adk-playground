import { BaseAgent, type InvocationContext, type Event } from "@google/adk";
import { log } from "../logger/index.js";
import { type AppConfig } from "../config/schema.js";
import { buildNavigatorAgent } from "./navigator.js";
import { buildValidatorAgent } from "./validator.js";
import { buildEvaluatorAgent } from "./evaluator.js";
import { buildReporterAgent } from "./reporter.js";

/**
 * Orchestrates the QA flow: Navigator -> Validator -> Reporter.
 * This agent is deterministic and doesn't use an LLM for its own logic.
 */
export class OrchestratorAgent extends BaseAgent {
  private navigatorLoop;
  private validator;
  private evaluator;
  private reporter;

  constructor(config: AppConfig) {
    const navigatorLoop = buildNavigatorAgent(config);
    const validator = buildValidatorAgent(config);
    const evaluator = buildEvaluatorAgent(config);
    const reporter = buildReporterAgent(config);
    super({
      name: "orchestrator",
      subAgents: [navigatorLoop, validator, evaluator, reporter],
    });
    this.navigatorLoop = navigatorLoop;
    this.validator = validator;
    this.evaluator = evaluator;
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

    // Phase 2: Validate outcomes -- capture validation_result explicitly
    let capturedValidationResult = "";
    try {
      for await (const event of this.validator.runAsync(ctx)) {
        if (event.actions?.stateDelta) {
          Object.assign(ctx.session.state, event.actions.stateDelta);
          if (event.actions.stateDelta["validation_result"]) {
            capturedValidationResult = event.actions.stateDelta[
              "validation_result"
            ] as string;
          }
        }
        yield event;
      }
    } catch (e) {
      // Validator may crash (e.g., LLM calls a tool not in its toolset).
      // Log and continue so the reporter phase still runs and we get a result.
      log.warn(
        `[Validator error: ${(e as Error).message}] -- continuing to reporter`,
      );
      ctx.session.state["validation_result"] =
        `VALIDATOR_ERROR: ${(e as Error).message}`;
    }
    // Safety net
    if (capturedValidationResult && !ctx.session.state["validation_result"]) {
      ctx.session.state["validation_result"] = capturedValidationResult;
    }

    // Phase 2.5: Evaluate validator output for rubber-stamping
    // Skip when no assertions were recorded — nothing meaningful to evaluate.
    const recordedAssertions = JSON.parse(
      (ctx.session.state["assertions"] as string) || "[]",
    );
    if (recordedAssertions.length > 0) {
      try {
        for await (const event of this.evaluator.runAsync(ctx)) {
          if (event.actions?.stateDelta) {
            Object.assign(ctx.session.state, event.actions.stateDelta);
          }
          yield event;
        }
      } catch (e) {
        log.warn(
          `[Evaluator error: ${(e as Error).message}] -- continuing to reporter`,
        );
      }
    }

    // Phase 3: Generate report
    try {
      for await (const event of this.reporter.runAsync(ctx)) {
        if (event.actions?.stateDelta) {
          Object.assign(ctx.session.state, event.actions.stateDelta);
        }
        yield event;
      }
    } catch (e) {
      // Reporter may crash (e.g., LLM calls a tool not in its toolset).
      // Log and continue so we still get partial results.
      log.warn(`[Reporter error: ${(e as Error).message}] -- continuing`);
      if (!ctx.session.state["final_report"]) {
        ctx.session.state["final_report"] =
          `REPORTER_ERROR: ${(e as Error).message}`;
      }
    }
  }

  // OrchestratorAgent is deterministic and doesn't need to implement runLiveImpl
  protected async *runLiveImpl(ctx: InvocationContext): AsyncGenerator<Event> {
    yield* this.runAsyncImpl(ctx);
  }
}
