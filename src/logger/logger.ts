import type { LogLevel, LogContext, LogEntry, LogTransport } from "./types.js";
import { BufferTransport } from "./transports/buffer.js";

export class Logger {
  private transports: LogTransport[];
  private verbose = false;
  private bufferTransport: BufferTransport | null = null;

  constructor(transports: LogTransport[]) {
    this.transports = transports;
  }

  /**
   * Switches to buffer-only mode for subprocess workers.
   * Replaces all transports with a BufferTransport so logs are captured
   * in memory and can be included in the worker's JSON output.
   */
  setWorkerMode(): void {
    this.bufferTransport = new BufferTransport();
    this.transports = [this.bufferTransport];
  }

  /**
   * Returns captured log entries (only populated after setWorkerMode() is called).
   */
  getBufferedLogs(): LogEntry[] {
    return this.bufferTransport?.getEntries() ?? [];
  }

  setVerbose(value: boolean): void {
    this.verbose = value;
  }

  isVerbose(): boolean {
    return this.verbose;
  }

  debug(message: string, context?: LogContext): void {
    if (!this.verbose) return;
    this.emit("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.emit("info", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.emit("warn", message, context);
  }

  error(message: string, context?: LogContext): void {
    this.emit("error", message, context);
  }

  async group(name: string, fn: () => Promise<void>): Promise<void> {
    for (const transport of this.transports) {
      transport.groupStart?.(name);
    }
    try {
      await fn();
    } finally {
      for (const transport of this.transports) {
        transport.groupEnd?.();
      }
    }
  }

  async flush(): Promise<void> {
    await Promise.all(this.transports.map((t) => t.flush()));
  }

  private emit(level: LogLevel, message: string, context?: LogContext): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };
    for (const transport of this.transports) {
      transport.write(entry);
    }
  }
}
