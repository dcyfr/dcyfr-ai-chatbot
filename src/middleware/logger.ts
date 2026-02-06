/**
 * Logger Middleware - Structured conversation logging
 *
 * Provides structured logging for all chat interactions,
 * useful for debugging, analytics, and audit trails.
 */

import type { Middleware, MiddlewareContext, MiddlewareResult } from '../types/index.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  timestamp: number;
  conversationId: string;
  event: string;
  data?: Record<string, unknown>;
}

export interface LoggerOptions {
  /** Minimum log level */
  level?: LogLevel;
  /** Custom log handler */
  handler?: (entry: LogEntry) => void;
  /** Whether to log message content (disable for privacy) */
  logContent?: boolean;
}

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Create a logger middleware
 */
export function createLogger(options?: LoggerOptions): Middleware {
  const minLevel = options?.level ?? 'info';
  const logContent = options?.logContent ?? false;
  const handler = options?.handler ?? defaultLogHandler;
  const minLevelOrder = LOG_LEVEL_ORDER[minLevel];

  function log(level: LogLevel, entry: Omit<LogEntry, 'level' | 'timestamp'>): void {
    if (LOG_LEVEL_ORDER[level] >= minLevelOrder) {
      handler({ ...entry, level, timestamp: Date.now() });
    }
  }

  return {
    name: 'logger',
    description: 'Structured conversation logger',
    priority: -50, // Run after rate limiter and content filter
    execute: async (
      context: MiddlewareContext,
      next: () => Promise<MiddlewareResult>
    ): Promise<MiddlewareResult> => {
      const startTime = Date.now();

      log('info', {
        conversationId: context.conversation.id,
        event: 'chat.request',
        data: {
          messageLength: context.request.message.length,
          model: context.config.model,
          ...(logContent ? { message: context.request.message } : {}),
        },
      });

      try {
        const result = await next();
        const duration = Date.now() - startTime;

        if (result.proceed) {
          log('info', {
            conversationId: context.conversation.id,
            event: 'chat.response',
            data: { durationMs: duration },
          });
        } else {
          log('warn', {
            conversationId: context.conversation.id,
            event: 'chat.blocked',
            data: { durationMs: duration, error: result.error },
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        log('error', {
          conversationId: context.conversation.id,
          event: 'chat.error',
          data: {
            durationMs: duration,
            error: error instanceof Error ? error.message : String(error),
          },
        });
        throw error;
      }
    },
  };
}

/**
 * Default log handler - outputs to console
 */
function defaultLogHandler(entry: LogEntry): void {
  const prefix = `[${entry.level.toUpperCase()}]`;
  const message = `${prefix} ${entry.event} (${entry.conversationId})`;

  switch (entry.level) {
    case 'debug':
      console.debug(message, entry.data ?? '');
      break;
    case 'info':
      console.info(message, entry.data ?? '');
      break;
    case 'warn':
      console.warn(message, entry.data ?? '');
      break;
    case 'error':
      console.error(message, entry.data ?? '');
      break;
  }
}

/**
 * Create an in-memory log store for testing
 */
export class LogStore {
  private entries: LogEntry[] = [];

  handler = (entry: LogEntry): void => {
    this.entries.push(entry);
  };

  getEntries(filter?: { level?: LogLevel; event?: string }): LogEntry[] {
    let result = [...this.entries];
    if (filter?.level) {
      result = result.filter((e) => e.level === filter.level);
    }
    if (filter?.event) {
      result = result.filter((e) => e.event === filter.event);
    }
    return result;
  }

  clear(): void {
    this.entries = [];
  }

  get size(): number {
    return this.entries.length;
  }
}
