/**
 * Chat Engine tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ChatEngine } from '../../../src/chat/engine.js';
import { MockProvider } from '../../../src/providers/mock.js';
import { createMiddleware } from '../../../src/middleware/pipeline.js';
import type { Plugin } from '../../../src/types/index.js';

describe('ChatEngine', () => {
  let engine: ChatEngine;
  let provider: MockProvider;

  beforeEach(() => {
    provider = new MockProvider({
      defaultResponse: 'Mock response',
      responses: new Map([
        ['hello', 'Hi there!'],
        ['tool', 'Let me use a tool for that.'],
      ]),
    });

    engine = new ChatEngine(
      {
        model: 'test-model',
        systemPrompt: 'You are a test bot.',
        temperature: 0.5,
      },
      provider
    );
  });

  describe('constructor', () => {
    it('should create engine with config defaults', () => {
      const e = new ChatEngine({}, provider);
      expect(e.config.model).toBe('gpt-4o');
      expect(e.config.temperature).toBe(0.7);
    });

    it('should apply custom config', () => {
      expect(engine.config.model).toBe('test-model');
      expect(engine.config.systemPrompt).toBe('You are a test bot.');
    });
  });

  describe('chat', () => {
    it('should return a response', async () => {
      const response = await engine.chat({ message: 'Hello!' });
      expect(response.message.content).toBe('Hi there!');
      expect(response.conversationId).toBeDefined();
      expect(response.finishReason).toBe('stop');
    });

    it('should create a new conversation', async () => {
      const response = await engine.chat({ message: 'Hello' });
      const conv = engine.conversations.get(response.conversationId);
      expect(conv).toBeDefined();
      expect(conv!.messages.length).toBe(2); // user + assistant
    });

    it('should continue existing conversation', async () => {
      const r1 = await engine.chat({ message: 'Hello' });
      const r2 = await engine.chat({
        message: 'How are you?',
        conversationId: r1.conversationId,
      });
      expect(r2.conversationId).toBe(r1.conversationId);
      const conv = engine.conversations.get(r1.conversationId);
      expect(conv!.messages.length).toBe(4); // 2 user + 2 assistant
    });

    it('should include usage stats', async () => {
      const response = await engine.chat({ message: 'Hello' });
      expect(response.usage).toBeDefined();
      expect(response.usage!.totalTokens).toBeGreaterThan(0);
    });

    it('should auto-initialize on first chat', async () => {
      await engine.chat({ message: 'Hello' });
      // No error means init succeeded
    });
  });

  describe('stream', () => {
    it('should stream tokens', async () => {
      const chunks: string[] = [];
      for await (const chunk of engine.stream({ message: 'Hello', stream: true })) {
        if (chunk.type === 'token' && typeof chunk.data === 'string') {
          chunks.push(chunk.data);
        }
      }
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toContain('Hi');
    });

    it('should emit a done chunk', async () => {
      let gotDone = false;
      for await (const chunk of engine.stream({ message: 'Hello' })) {
        if (chunk.type === 'done') {
          gotDone = true;
        }
      }
      expect(gotDone).toBe(true);
    });

    it('should save assistant message after streaming', async () => {
      let convId = '';
      for await (const chunk of engine.stream({
        message: 'Hello',
        conversationId: 'stream-conv',
      })) {
        convId = 'stream-conv';
      }
      const conv = engine.conversations.get(convId);
      expect(conv).toBeDefined();
      // user + assistant messages
      const assistantMsgs = conv!.messages.filter((m) => m.role === 'assistant');
      expect(assistantMsgs.length).toBe(1);
    });
  });

  describe('middleware', () => {
    it('should run middleware before chat', async () => {
      let middlewareCalled = false;
      engine.use(
        createMiddleware('test-mw', async (ctx, next) => {
          middlewareCalled = true;
          return next();
        })
      );

      await engine.chat({ message: 'Hello' });
      expect(middlewareCalled).toBe(true);
    });

    it('should block request if middleware rejects', async () => {
      engine.use(
        createMiddleware('blocker', async (ctx, _next) => ({
          proceed: false,
          context: ctx,
          error: 'Blocked by test',
        }))
      );

      const response = await engine.chat({ message: 'Hello' });
      expect(response.finishReason).toBe('error');
      expect(response.message.content).toContain('Blocked');
    });
  });

  describe('plugins', () => {
    it('should call plugin hooks', async () => {
      let beforeCalled = false;
      let afterCalled = false;

      const plugin: Plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        hooks: {
          onBeforeChat: async (ctx) => {
            beforeCalled = true;
            return ctx;
          },
          onAfterChat: async (response) => {
            afterCalled = true;
            return response;
          },
        },
      };

      engine.registerPlugin(plugin);
      await engine.chat({ message: 'Hello' });
      expect(beforeCalled).toBe(true);
      expect(afterCalled).toBe(true);
    });

    it('should call error hook on failure', async () => {
      let errorCaught = false;
      const failProvider = new MockProvider({ simulateErrors: true, errorRate: 1.0 });
      const failEngine = new ChatEngine({}, failProvider);

      failEngine.registerPlugin({
        name: 'error-catcher',
        version: '1.0.0',
        hooks: {
          onError: async () => {
            errorCaught = true;
          },
        },
      });

      await expect(failEngine.chat({ message: 'Hello' })).rejects.toThrow();
      expect(errorCaught).toBe(true);
    });
  });

  describe('tools', () => {
    it('should register tools', () => {
      engine.registerTool({
        name: 'test-tool',
        description: 'A test tool',
        parameters: {},
      });
      expect(engine.getToolNames()).toContain('test-tool');
    });
  });

  describe('destroy', () => {
    it('should clean up engine state', async () => {
      await engine.chat({ message: 'Hello' });
      await engine.destroy();
      expect(engine.conversations.size).toBe(0);
      expect(engine.getToolNames().length).toBe(0);
    });

    it('should call plugin destroy hooks', async () => {
      let destroyed = false;
      engine.registerPlugin({
        name: 'cleanup',
        version: '1.0.0',
        hooks: {
          onDestroy: async () => {
            destroyed = true;
          },
        },
      });
      await engine.init();
      await engine.destroy();
      expect(destroyed).toBe(true);
    });
  });
});
