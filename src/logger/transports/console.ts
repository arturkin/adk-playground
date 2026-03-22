import type { LogEntry, LogTransport } from "../types.js";

const COLORS: Record<string, string> = {
  debug: "\x1b[90m", // gray
  info: "\x1b[36m", // cyan
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

export class ConsoleTransport implements LogTransport {
  private groupDepth = 0;

  write(entry: LogEntry): void {
    const indent = "  ".repeat(this.groupDepth);
    const color = COLORS[entry.level] ?? COLORS.reset;
    const prefix =
      entry.level === "info"
        ? ""
        : `${color}[${entry.level.toUpperCase()}]${COLORS.reset} `;
    const contextStr = entry.context ? ` ${formatContext(entry.context)}` : "";

    const output = `${indent}${prefix}${entry.message}${contextStr}`;

    if (entry.level === "error") {
      console.error(output);
    } else if (entry.level === "warn") {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  groupStart(name: string): void {
    const indent = "  ".repeat(this.groupDepth);
    console.log(`${indent}${COLORS.bold}${name}${COLORS.reset}`);
    this.groupDepth++;
  }

  groupEnd(): void {
    if (this.groupDepth > 0) this.groupDepth--;
  }

  async flush(): Promise<void> {
    // Console output is synchronous, nothing to flush
  }
}

function formatContext(
  context: Record<string, string | number | boolean | undefined>,
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined) {
      parts.push(`${COLORS.debug}${key}=${String(value)}${COLORS.reset}`);
    }
  }
  return parts.length > 0 ? `(${parts.join(", ")})` : "";
}
