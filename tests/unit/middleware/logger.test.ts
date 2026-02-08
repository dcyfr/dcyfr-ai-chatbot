/**
 * Logger Middleware tests
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLogger, LogStore } from '../../../src/middleware/logger.js';
import type { MiddlewareContext } from '../../../src/types/index.js';
import { ChatConfigSchema } from '../../../src/types/index.js';

function createContext(message = 'Hello'): MiddlewareContext {
  return {
    request: { message, role: 'user', stream: false },
    conversation: {
      id: 'conv-1',
      messages: [],
      metadata: { totalTokens: 0, messageCount: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    config: ChatConfigSchema.parse({}),
    metadata: {},
  };
}

describe('LogStore', () => {
  it('should collect log entries', () => {
    const store = new LogStore();
    store.handler({
      level: 'info',
      timestamp: Date.now(),
      conversationId: 'conv-1',
      event: 'test',
    });
    expect(store.size).toBe(1);
  });

  it('should filter by level', () => {
    const store = new LogStore();
    store.handler({ level: 'info', timestamp: Date.now(), conversationId: 'c1', event: 'a' });
    store.handler({ level: 'error', timestamp: Date.now(), conversationId: 'c1', event: 'b' });
    store.handler({ level: 'info', timestamp: Date.now(), conversationId: 'c1', event: 'c' });
    expect(store.getEntries({ level: 'info' }).length).toBe(2);
    expect(store.getEntries({ level: 'error' }).length).toBe(1);
  });

  it('should filter by event', () => {
    const store = new LogStore();
    store.handler({ level: 'info', timestamp: Date.now(), conversationId: 'c1', event: 'chat.request' });
    store.handler({ level: 'info', timestamp: Date.now(), conversationId: 'c1', event: 'chat.response' });
    expect(store.getEntries({ event: 'chat.request' }).length).toBe(1);
  });

  it('should clear entries', () => {
    const store = new LogStore();
    store.handler({ level: 'info', timestamp: Date.now(), conversationId: 'c1', event: 'test' });
    store.clear();
    expect(store.size).toBe(0);
  });
});

describe('createLogger middleware', () => {
  it('should log request and response', async () => {
    const store = new LogStore();
    const logger = createLogger({ handler: store.handler });
    const ctx = createContext();

    await logger.execute(
      ctx,
      async () => ({ proceed: true, context: ctx })
    );

    const entries = store.getEntries();
    expect(entries.length).toBe(2);
    expect(entries[0].event).toBe('chat.request');
    expect(entries[1].event).toBe('chat.response');
  });

  it('should log blocked requests', async () => {
    const store = new LogStore();
    const logger = createLogger({ handler: store.handler });
    const ctx = createContext();

    await logger.execute(
      ctx,
      async () => ({ proceed: false, context: ctx, error: 'Blocked' })
    );

    const warns = store.getEntries({ level: 'warn' });
    expect(warns.length).toBe(1);
    expect(warns[0].event).toBe('chat.blocked');
  });

  it('should log errors', async () => {
    const store = new LogStore();
    const logger = createLogger({ handler: store.handler });
    const ctx = createContext();

    await expect(
      logger.execute(ctx, async () => {
        throw new Error('Test error');
      })
    ).rejects.toThrow('Test error');

    const errors = store.getEntries({ level: 'error' });
    expect(errors.length).toBe(1);
    expect(errors[0].event).toBe('chat.error');
  });

  it('should respect log level', async () => {
    const store = new LogStore();
    const logger = createLogger({ handler: store.handler, level: 'warn' });
    const ctx = createContext();

    await logger.execute(
      ctx,
      async () => ({ proceed: true, context: ctx })
    );

    // 'info' level should be filtered out (min level is 'warn')
    expect(store.size).toBe(0);
  });

  it('should include message content when logContent is true', async () => {
    const store = new LogStore();
    const logger = createLogger({ handler: store.handler, logContent: true });
    const ctx = createContext('Secret message');

    await logger.execute(
      ctx,
      async () => ({ proceed: true, context: ctx })
    );

    const request = store.getEntries({ event: 'chat.request' })[0];
    expect(request.data?.['message']).toBe('Secret message');
  });

  it('should exclude message content by default', async () => {
    const store = new LogStore();
    const logger = createLogger({ handler: store.handler });
    const ctx = createContext('Secret message');

    await logger.execute(
      ctx,
      async () => ({ proceed: true, context: ctx })
    );

    const request = store.getEntries({ event: 'chat.request' })[0];
    expect(request.data?.['message']).toBeUndefined();
  });

  it('should have correct metadata', () => {
    const logger = createLogger();
    expect(logger.name).toBe('logger');
    expect(logger.priority).toBe(-50);
  });

  describe('defaultLogHandler', () => {
    let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
    let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    afterEach(() => {
      consoleDebugSpy?.mockRestore();
      consoleInfoSpy?.mockRestore();
      consoleWarnSpy?.mockRestore();
      consoleErrorSpy?.mockRestore();
    });

    it('should log debug level to console.debug', async () => {
      consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const logger = createLogger({ level: 'debug' });
      const ctx = createContext();

      await logger.execute(ctx, async () => ({ proceed: true, context: ctx }));

      // Should have request (info) and response (info) logs
      // When level is 'debug', both should go through console.info
      expect(consoleDebugSpy).not.toHaveBeenCalled(); // No debug events in this test
    });

    it('should log info level to console.info', async () => {
      consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const logger = createLogger({ level: 'info' });
      const ctx = createContext();

      await logger.execute(ctx, async () => ({ proceed: true, context: ctx }));

      // Should log request and response
      expect(consoleInfoSpy).toHaveBeenCalledTimes(2);
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] chat.request'),
        expect.anything()
      );
    });

    it('should log warn level to console.warn', async () => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const logger = createLogger({ level: 'warn' });
      const ctx = createContext();

      await logger.execute(ctx, async () => ({
        proceed: false,
        context: ctx,
        error: 'Blocked',
      }));

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WARN] chat.blocked'),
        expect.anything()
      );
    });

    it('should log error level to console.error', async () => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logger = createLogger({ level: 'error' });
      const ctx = createContext();

      await expect(
        logger.execute(ctx, async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] chat.error'),
        expect.anything()
      );
    });

    it('should include conversation ID in log output', async () => {
      consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const logger = createLogger();
      const ctx = createContext();
      ctx.conversation.id = 'test-conv-id';

      await logger.execute(ctx, async () => ({ proceed: true, context: ctx }));

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('(test-conv-id)'),
        expect.anything()
      );
    });

    it('should handle data in log entries', async () => {
      consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const logger = createLogger({ logContent: false });
      const ctx = createContext();

      await logger.execute(ctx, async () => ({ proceed: true, context: ctx }));

      // Should log with data object (including durationMs)
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] chat.request'),
        expect.anything()
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] chat.response'),
        expect.objectContaining({ durationMs: expect.any(Number) })
      );
    });
  });
});
