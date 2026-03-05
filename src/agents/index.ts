import { InMemoryRunner } from "@google/adk";
import { type AppConfig } from "../config/schema.js";
import { OrchestratorAgent } from "./orchestrator.js";

/**
 * Creates an ADK Runner configured with the QA Orchestrator agent.
 */
export function createRunner(config: AppConfig) {
  const orchestrator = new OrchestratorAgent(config);
  return new InMemoryRunner({
    agent: orchestrator,
    appName: "adk-qa",
  });
}

export * from "./orchestrator.js";
export * from "./navigator.js";
export * from "./validator.js";
export * from "./reporter.js";
export * from "./callbacks.js";
