import type { LogEntry, LogTransport } from "../types.js";

export class CiTransport implements LogTransport {
  write(entry: LogEntry): void {
    // Emit GH Actions annotations for errors and warnings
    if (entry.level === "error") {
      const file = entry.context?.["file"]
        ? ` file=${entry.context["file"]}`
        : "";
      console.log(`::error${file}::${entry.message}`);
    } else if (entry.level === "warn") {
      const file = entry.context?.["file"]
        ? ` file=${entry.context["file"]}`
        : "";
      console.log(`::warning${file}::${entry.message}`);
    }

    // Always emit structured JSON line
    const structured = {
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
      ...entry.context,
    };
    console.log(JSON.stringify(structured));
  }

  groupStart(name: string): void {
    console.log(`::group::${name}`);
  }

  groupEnd(): void {
    console.log("::endgroup::");
  }

  async flush(): Promise<void> {
    // Stdout is synchronous, nothing to flush
  }
}
