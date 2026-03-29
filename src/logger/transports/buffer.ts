import type { LogEntry, LogTransport } from "../types.js";

/**
 * Collects log entries in memory.
 * Used by subprocess workers so logs can be included in the JSON result
 * and replayed by the parent process as a contiguous block.
 */
export class BufferTransport implements LogTransport {
  private entries: LogEntry[] = [];
  private groupDepth = 0;

  write(entry: LogEntry): void {
    this.entries.push({ ...entry, context: { ...entry.context, _groupDepth: this.groupDepth } });
  }

  groupStart(name: string): void {
    this.entries.push({
      level: "info",
      message: name,
      timestamp: new Date().toISOString(),
      context: { _groupStart: true, _groupDepth: this.groupDepth },
    });
    this.groupDepth++;
  }

  groupEnd(): void {
    if (this.groupDepth > 0) this.groupDepth--;
  }

  async flush(): Promise<void> {
    // In-memory, nothing to flush
  }

  getEntries(): LogEntry[] {
    return this.entries;
  }
}
