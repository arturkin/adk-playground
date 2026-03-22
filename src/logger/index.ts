import { Logger } from "./logger.js";
import { ConsoleTransport } from "./transports/console.js";
import { CiTransport } from "./transports/ci.js";
import { GcpTransport } from "./transports/gcp.js";
import type { LogTransport } from "./types.js";

function createLogger(): Logger {
  const transports: LogTransport[] = [new ConsoleTransport()];

  if (process.env["CI"] === "true") {
    transports.push(new CiTransport());
  }

  const gcpProjectId = process.env["GCP_PROJECT_ID"];
  const gcpSaKey = process.env["GCP_SA_KEY"];
  if (gcpProjectId && gcpSaKey) {
    transports.push(new GcpTransport(gcpProjectId, gcpSaKey));
  }

  return new Logger(transports);
}

export const log = createLogger();

// Convenience re-exports for backward compatibility
export function setVerbose(value: boolean): void {
  log.setVerbose(value);
}

export function isVerbose(): boolean {
  return log.isVerbose();
}

// Flush on process exit
process.on("beforeExit", () => {
  void log.flush();
});

process.on("SIGTERM", () => {
  void log.flush().then(() => process.exit(0));
});

process.on("SIGINT", () => {
  void log.flush().then(() => process.exit(0));
});

export type { LogLevel, LogContext, LogEntry, LogTransport } from "./types.js";
export { Logger } from "./logger.js";
