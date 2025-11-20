/**
 * Structured Logging System
 *
 * Provides:
 * - Request correlation IDs for distributed tracing
 * - Structured log output (JSON in production, pretty in dev)
 * - Log levels with filtering
 * - Contextual logging with metadata
 * - Performance tracking
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  userId?: string;
  contractorId?: string;
  leadId?: string;
  estimateId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  duration?: number;
}

class Logger {
  private isDevelopment: boolean;
  private minLevel: LogLevel;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  }

  /**
   * Check if a log level should be emitted
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const levelIndex = levels.indexOf(level);
    const minLevelIndex = levels.indexOf(this.minLevel);
    return levelIndex >= minLevelIndex;
  }

  /**
   * Format log entry for output
   */
  private formatLog(entry: LogEntry): string {
    if (this.isDevelopment) {
      // Pretty format for development
      const timestamp = new Date(entry.timestamp).toLocaleTimeString();
      const levelEmoji = {
        debug: '🔍',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
      };

      let output = `${levelEmoji[entry.level]} [${timestamp}] ${entry.message}`;

      if (entry.context && Object.keys(entry.context).length > 0) {
        output += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`;
      }

      if (entry.error) {
        output += `\n  Error: ${entry.error.message}`;
        if (entry.error.stack) {
          output += `\n  Stack: ${entry.error.stack}`;
        }
      }

      if (entry.duration !== undefined) {
        output += `\n  Duration: ${entry.duration}ms`;
      }

      return output;
    } else {
      // JSON format for production (easier for log aggregation)
      return JSON.stringify(entry);
    }
  }

  /**
   * Write log entry
   */
  private write(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };

    if (error) {
      entry.error = {
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
        code: (error as any).code,
      };
    }

    const formatted = this.formatLog(entry);

    // Output to appropriate stream
    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  /**
   * Debug level logging
   */
  debug(message: string, context?: LogContext) {
    this.write('debug', message, context);
  }

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext) {
    this.write('info', message, context);
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext) {
    this.write('warn', message, context);
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error, context?: LogContext) {
    this.write('error', message, context, error);
  }

  /**
   * Create a child logger with shared context
   */
  child(context: LogContext): ChildLogger {
    return new ChildLogger(this, context);
  }

  /**
   * Time a block of code
   */
  async time<T>(
    label: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const start = Date.now();
    this.debug(`Starting: ${label}`, context);

    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.info(`Completed: ${label}`, { ...context, duration });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(
        `Failed: ${label}`,
        error instanceof Error ? error : new Error(String(error)),
        { ...context, duration }
      );
      throw error;
    }
  }
}

/**
 * Child logger with shared context
 */
class ChildLogger {
  constructor(
    private parent: Logger,
    private baseContext: LogContext
  ) {}

  private mergeContext(context?: LogContext): LogContext {
    return { ...this.baseContext, ...context };
  }

  debug(message: string, context?: LogContext) {
    this.parent.debug(message, this.mergeContext(context));
  }

  info(message: string, context?: LogContext) {
    this.parent.info(message, this.mergeContext(context));
  }

  warn(message: string, context?: LogContext) {
    this.parent.warn(message, this.mergeContext(context));
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.parent.error(message, error, this.mergeContext(context));
  }

  async time<T>(label: string, fn: () => Promise<T>, context?: LogContext): Promise<T> {
    return this.parent.time(label, fn, this.mergeContext(context));
  }
}

/**
 * Global logger instance
 */
export const logger = new Logger();

/**
 * Create request-scoped logger with correlation ID
 */
export function createRequestLogger(request: Request): ChildLogger {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);

  return logger.child({
    requestId,
    method: request.method,
    path: url.pathname,
  });
}

/**
 * Generate a correlation ID for tracking across services
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}
