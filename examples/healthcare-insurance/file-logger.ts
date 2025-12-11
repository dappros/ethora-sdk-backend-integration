/**
 * File logger utility for demo backend
 * Logs to both console and file
 */

import fs from "fs";
import path from "path";

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

class FileLogger {
  private logDir: string;
  private logFile: string;

  constructor() {
    // Create logs directory in the healthcare-insurance example folder
    this.logDir = path.resolve(process.cwd(), "examples/healthcare-insurance/logs");
    this.logFile = path.join(this.logDir, `backend-${new Date().toISOString().split("T")[0]}.log`);

    // Ensure logs directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | Data: ${JSON.stringify(data, null, 2)}` : "";
    return `[${timestamp}] [${level}] ${message}${dataStr}\n`;
  }

  private writeToFile(message: string): void {
    try {
      fs.appendFileSync(this.logFile, message, "utf8");
    } catch (error) {
      console.error("Failed to write to log file:", error);
    }
  }

  debug(message: string, data?: unknown): void {
    const formatted = this.formatMessage(LogLevel.DEBUG, message, data);
    console.debug(formatted.trim());
    this.writeToFile(formatted);
  }

  info(message: string, data?: unknown): void {
    const formatted = this.formatMessage(LogLevel.INFO, message, data);
    console.info(formatted.trim());
    this.writeToFile(formatted);
  }

  warn(message: string, data?: unknown): void {
    const formatted = this.formatMessage(LogLevel.WARN, message, data);
    console.warn(formatted.trim());
    this.writeToFile(formatted);
  }

  error(message: string, error?: Error | unknown, data?: unknown): void {
    const errorInfo = error instanceof Error ? error.stack : String(error);
    const formatted = this.formatMessage(
      LogLevel.ERROR,
      `${message}${errorInfo ? ` | Error: ${errorInfo}` : ""}`,
      data
    );
    console.error(formatted.trim());
    this.writeToFile(formatted);
  }

  step(stepNumber: number, stepName: string, data?: unknown): void {
    const message = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSTEP ${stepNumber}: ${stepName}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    const formatted = this.formatMessage(LogLevel.INFO, message, data);
    console.info(`\n${formatted.trim()}\n`);
    this.writeToFile(`\n${formatted}`);
  }

  success(message: string, data?: unknown): void {
    const formatted = this.formatMessage(LogLevel.INFO, `✓ ${message}`, data);
    console.info(formatted.trim());
    this.writeToFile(formatted);
  }
}

// Singleton instance
let loggerInstance: FileLogger | null = null;

export function getFileLogger(): FileLogger {
  if (!loggerInstance) {
    loggerInstance = new FileLogger();
  }
  return loggerInstance;
}


