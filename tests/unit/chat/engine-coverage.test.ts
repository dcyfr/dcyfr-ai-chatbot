/**
 * Chat Engine - Additional coverage tests for branch coverage
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ChatEngine } from '../../../src/chat/engine.js';
import { MockProvider } from '../../../src/providers/mock.js';
import { createMiddleware } from '../../../src/middleware/pipeline.js';
import type { Plugin, ToolDefinition } from '../../../src/types/index.js';

describe('ChatEngine - Branch Coverage', () => {
  let engine: ChatEngine;
  let provider: MockProvider;

  beforeEach(() => {
    provider = new MockProvider({
      defaultResponse: 'Mock response',
    });

    engine = new ChatEngine(
      {
        model: 'test-model',
        systemPrompt: 'You are a test bot.',
      },
      provider
    );
  });

  describe('middleware blocking scenarios', () => {
    it('should handle middleware blocking without error message', async () => {
      const blockingMiddleware = createMiddleware(
        'blocker',
        async () => ({ proceed: false }),
        { priority: 0 }
      );

      engine.use(blockingMiddleware);

      const response = await engine.chat({ message: 'Hello' });
      expect(response.finishReason).toBe('error');
      expect(response.message.content).toBe('Request blocked by middleware');
    });

    it('should handle middleware blocking with custom error', async () => {
      const blockingMiddleware = createMiddleware(
        'blocker',
        async () => ({ proceed: false, error: 'Custom block message' }),
        { priority: 0 }
      );

      engine.use(blockingMiddleware);

      const response = await engine.chat({ message: 'Hello' });
      expect(response.message.content).toBe('Custom block message');
    });

    it('should handle middleware modifying context', async () => {
      const modifyingMiddleware = createMiddleware(
        'modifier',
        async (ctx, next) => {
          ctx.metadata.modified = true;
          const result = await next();
          return result;
        },
        { priority: 0 }
      );

      engine.use(modifyingMiddleware);

      const response = await engine.chat({ message: 'Hello' });
      expect(response.finishReason).toBe('stop');
    });
  });

  describe('tool handling', () => {
    it('should register tools from config', () => {
      const tool: ToolDefinition = {
        name: 'calculator',
        description: 'Performs calculations',
        parameters: {
          type: 'object',
          properties: {
            expression: { type: 'string' },
          },
          required: ['expression'],
        },
      };

      const engineWithTools = new ChatEngine(
        {
          tools: [tool],
        },
        provider
      );

      expect(engineWithTools.getToolNames()).toContain('calculator');
    });

    it('should register multiple tools', () => {
      const tool1: ToolDefinition = {
        name: 'tool1',
        description: 'First tool',
        parameters: {},
      };
      const tool2: ToolDefinition = {
        name: 'tool2',
        description: 'Second tool',
        parameters: {},
      };

      engine.registerTool(tool1);
      engine.registerTool(tool2);

      expect(engine.getToolNames()).toContain('tool1');
      expect(engine.getToolNames()).toContain('tool2');
    });
  });

  describe('plugin hooks edge cases', () => {
    it('should handle plugins without init hook', async () => {
      const plugin: Plugin = {
        name: 'no-init',
        version: '1.0.0',
        hooks: {
          onBeforeChat: async (ctx) => ctx,
        },
      };

      engine.registerPlugin(plugin);
      await engine.init();

      const response = await engine.chat({ message: 'Hello' });
      expect(response.finishReason).toBe('stop');
    });

    it('should handle plugins without destroy hook', async () => {
      const plugin: Plugin = {
        name: 'no-destroy',
        version: '1.0.0',
        hooks: {
          onInit: async () => {},
        },
      };

      engine.registerPlugin(plugin);
      await engine.init();
      await engine.destroy();

      expect(engine.conversations.size).toBe(0);
    });

    it('should call onAfterChat hook', async () => {
      let afterChatCalled = false;

      const plugin: Plugin = {
        name: 'after-chat',
        version: '1.0.0',
        hooks: {
          onAfterChat: async (response) => {
            afterChatCalled = true;
            return response;
          },
        },
      };

      engine.registerPlugin(plugin);
      await engine.chat({ message: 'Hello' });

      expect(afterChatCalled).toBe(true);
    });

    it('should call onBeforeChat hook', async () => {
      let beforeChatCalled = false;

      const plugin: Plugin = {
        name: 'before-chat',
        version: '1.0.0',
        hooks: {
          onBeforeChat: async (ctx) => {
            beforeChatCalled = true;
            return ctx;
          },
        },
      };

      engine.registerPlugin(plugin);
      await engine.chat({ message: 'Hello' });

      expect(beforeChatCalled).toBe(true);
    });
  });

  describe('streaming edge cases', () => {
    it('should handle empty stream content', async () => {
      const emptyProvider = new MockProvider({
        defaultResponse: '',
      });
      const emptyEngine = new ChatEngine({}, emptyProvider);

      const chunks: any[] = [];
      for await (const chunk of emptyEngine.stream({ message: 'Hello' })) {
        chunks.push(chunk);
      }

      // Should still emit done chunk
      expect(chunks.some(c => c.type === 'done')).toBe(true);
    });

    it('should handle stream with no token chunks', async () => {
      const provider = new MockProvider({
        defaultResponse: 'Response',
      });
      const streamEngine = new ChatEngine({}, provider);

      let doneCount = 0;
      for await (const chunk of streamEngine.stream({ message: 'Hello' })) {
        if (chunk.type === 'done') {
          doneCount++;
        }
      }

      expect(doneCount).toBe(1);
    });
  });

  describe('conversation management', () => {
    it('should generate conversation ID if not provided', async () => {
      const response = await engine.chat({ message: 'Hello' });
      expect(response.conversationId).toBeTruthy();
      expect(typeof response.conversationId).toBe('string');
      expect(response.conversationId.length).toBeGreaterThan(0);
    });

    it('should use provided conversation ID', async () => {
      const customId = 'my-custom-id';
      const response = await engine.chat({
        message: 'Hello',
        conversationId: customId,
      });
      expect(response.conversationId).toBe(customId);
    });

    it('should maintain conversation across multiple messages', async () => {
      const r1 = await engine.chat({ message: 'First' });
      const r2 = await engine.chat({
        message: 'Second',
        conversationId: r1.conversationId,
      });
      const r3 = await engine.chat({
        message: 'Third',
        conversationId: r1.conversationId,
      });

      const conv = engine.conversations.get(r1.conversationId);
      expect(conv!.messages.length).toBe(6); // 3 user + 3 assistant
    });
  });

  describe('setProvider', () => {
    it('should allow changing the provider', async () => {
      const newProvider = new MockProvider({
        defaultResponse: 'New provider response',
      });

      engine.setProvider(newProvider);

      const response = await engine.chat({ message: 'Hello' });
      expect(response.message.content).toBe('New provider response');
    });
  });

  describe('repeated initialization', () => {
    it('should not re-initialize if already initialized', async () => {
      let initCount = 0;

      const plugin: Plugin = {
        name: 'init-counter',
        version: '1.0.0',
        hooks: {
          onInit: async () => {
            initCount++;
          },
        },
      };

      engine.registerPlugin(plugin);

      await engine.init();
      await engine.init();
      await engine.init();

      expect(initCount).toBe(1);
    });
  });
});
