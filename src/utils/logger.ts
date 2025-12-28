import { writeFileSync, appendFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  logDir?: string;
  maxLogFiles?: number;
  maxLogAgeDays?: number;
  minLevel?: LogLevel;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private logDir: string;
  private maxLogFiles: number;
  private maxLogAgeDays: number;
  private minLevel: LogLevel;
  private currentLogFile: string;

  constructor(config: LoggerConfig = {}) {
    this.logDir = config.logDir || join(process.cwd(), 'logs');
    this.maxLogFiles = config.maxLogFiles || 7;
    this.maxLogAgeDays = config.maxLogAgeDays || 7;
    this.minLevel = config.minLevel || 'info';

    // Ensure log directory exists
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }

    // Set current log file based on date
    this.currentLogFile = this.getLogFilePath();

    // Clean old logs on startup
    this.cleanOldLogs();
  }

  private getLogFilePath(): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return join(this.logDir, `mcp-server-${date}.log`);
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);

    let logMessage = `[${timestamp}] ${levelStr} ${message}`;

    if (data !== undefined) {
      if (data instanceof Error) {
        logMessage += `\n  Error: ${data.message}`;
        if (data.stack) {
          logMessage += `\n  Stack: ${data.stack}`;
        }
      } else if (typeof data === 'object') {
        try {
          logMessage += `\n  Data: ${JSON.stringify(data, null, 2)}`;
        } catch {
          logMessage += `\n  Data: [Unable to stringify]`;
        }
      } else {
        logMessage += `\n  Data: ${data}`;
      }
    }

    return logMessage;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private writeLog(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, data);

    // Update log file path if date changed
    const currentPath = this.getLogFilePath();
    if (currentPath !== this.currentLogFile) {
      this.currentLogFile = currentPath;
      this.cleanOldLogs();
    }

    // Write to file
    try {
      appendFileSync(this.currentLogFile, formattedMessage + '\n', 'utf-8');
    } catch (error) {
      // If we can't write to file, at least write to stderr
      console.error('Failed to write to log file:', error);
    }

    // Also write to console.error (for MCP system logs)
    // Only write errors and warnings to stderr by default
    if (level === 'error' || level === 'warn') {
      console.error(formattedMessage);
    }
  }

  private cleanOldLogs(): void {
    try {
      const files = readdirSync(this.logDir)
        .filter(f => f.startsWith('mcp-server-') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: join(this.logDir, f),
          mtime: statSync(join(this.logDir, f)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      const now = Date.now();
      const maxAge = this.maxLogAgeDays * 24 * 60 * 60 * 1000;

      // Remove files older than maxLogAgeDays or beyond maxLogFiles limit
      files.forEach((file, index) => {
        const age = now - file.mtime.getTime();
        if (index >= this.maxLogFiles || age > maxAge) {
          try {
            unlinkSync(file.path);
            this.debug(`Removed old log file: ${file.name}`);
          } catch (error) {
            this.error('Failed to remove old log file', error);
          }
        }
      });
    } catch (error) {
      // If cleaning fails, just continue
      console.error('Failed to clean old logs:', error);
    }
  }

  debug(message: string, data?: unknown): void {
    this.writeLog('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.writeLog('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.writeLog('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.writeLog('error', message, data);
  }

  // Utility method to log tool calls
  logToolCall(toolName: string, args: unknown, success: boolean, error?: unknown): void {
    if (success) {
      this.info(`Tool call: ${toolName}`, { args });
    } else {
      this.error(`Tool call failed: ${toolName}`, { args, error });
    }
  }

  // Utility method to log server events
  logServerEvent(event: string, details?: unknown): void {
    this.info(`Server event: ${event}`, details);
  }
}

// Create singleton instance
export const logger = new Logger({
  minLevel: (process.env.LOG_LEVEL as LogLevel) || 'info',
});

export default logger;
