/**
 * Logger utility for the Ethora SDK
 */

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, error?: Error | unknown, ...args: unknown[]): void;
}

/**
 * Simple console logger implementation
 */
class ConsoleLogger implements Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (process.env.NODE_ENV !== "production") {
      console.debug(this.formatMessage(LogLevel.DEBUG, message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    console.info(this.formatMessage(LogLevel.INFO, message), ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(this.formatMessage(LogLevel.WARN, message), ...args);
  }

  error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    const errorInfo = error instanceof Error ? error.stack : error;
    console.error(
      this.formatMessage(LogLevel.ERROR, message),
      errorInfo || "",
      ...args
    );
  }
}

/**
 * Logger cache to reuse logger instances
 */
const loggerCache = new Map<string, Logger>();

/**
 * Gets a logger instance for the given context
 * 
 * @param context - The context/name for the logger (typically the module name)
 * @returns Logger instance
 */
export function getLogger(context: string): Logger {
  if (!loggerCache.has(context)) {
    loggerCache.set(context, new ConsoleLogger(context));
  }
  return loggerCache.get(context)!;
}

