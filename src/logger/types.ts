export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: string | number | boolean | undefined;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
}

export interface LogTransport {
  write(entry: LogEntry): void;
  flush(): Promise<void>;
  groupStart?(name: string): void;
  groupEnd?(): void;
}
