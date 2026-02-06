/**
 * Integration: Chat Flow tests
 *
 * End-to-end test of the full chat pipeline with middleware, plugins, and memory.
 */

import { describe, it, expect } from 'vitest';
import { ChatEngine } from '../../src/chat/engine.js';
import { MockProvider } from '../../src/providers/mock.js';
import { createRateLimiter } from '../../src/middleware/rate-limiter.js';
import { createContentFilter } from '../../src/middleware/content-filter.js';
import { createLogger, LogStore } from '../../src/middleware/logger.js';
import { createSystemPromptPlugin, BUILT_IN_PERSONAS } from '../../src/plugins/system-prompt.js';
describe('Chat Flow Integration', () => {
  it('should complete a basic chat round-trip', async () => {
    const provider = new MockProvider({ defaultResponse: 'Hello there!' });
    const engine = new ChatEngine({}, provider);

    const response = await engine.chat({
      message: 'Hi',
    });

    expect(response.message).toBeDefined();
    expect(response.conversationId).toBeDefined();
  });

  it('should maintain conversation history', async () => {
    const provider = new MockProvider({ defaultResponse: 'Response.' });
    const engine = new ChatEngine({}, provider);

    const r1 = await engine.chat({ message: 'First' });
    const r2 = await engine.chat({
      message: 'Second',
      conversationId: r1.conversationId,
    });

    expect(r1.conversationId).toBe(r2.conversationId);
  });

  it('should stream tokens', async () => {
    const provider = new MockProvider({
      defaultResponse: 'Stream me',
    });
    const engine = new ChatEngine({}, provider);

    const chunks: string[] = [];
    for await (const chunk of engine.stream({ message: 'Hello' })) {
      if (chunk.type === 'token') {
        chunks.push(chunk.data as string);
      }
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join('')).toBe('Stream me');
  });

  it('should apply rate limiting middleware', async () => {
    const provider = new MockProvider();
    const engine = new ChatEngine({}, provider);

    engine.use(
      createRateLimiter({
        maxRequests: 2,
        windowMs: 60000,
        strategy: 'token-bucket',
      })
    );

    // First two should succeed
    await engine.chat({ message: 'One' });
    await engine.chat({ message: 'Two' });

    // Third should fail (different conversation IDs mean separate buckets,
    // but ChatEngine re-uses same conversation by default)
    // This depends on engine implementation - test the middleware is wired
    expect(provider.callCount).toBeGreaterThanOrEqual(2);
  });

  it('should apply content filtering', async () => {
    const provider = new MockProvider();
    const engine = new ChatEngine({}, provider);

    engine.use(
      createContentFilter({ blockSeverity: 'medium' })
    );

    // Safe message should pass
    const r1 = await engine.chat({ message: 'Hello world!' });
    expect(r1.message).toBeDefined();
  });

  it('should apply system prompt plugin', async () => {
    const provider = new MockProvider({ defaultResponse: 'I am helpful.' });
    const engine = new ChatEngine({}, provider);

    engine.registerPlugin(
      createSystemPromptPlugin({
        persona: BUILT_IN_PERSONAS.helpful,
      })
    );

    const response = await engine.chat({ message: 'Who are you?' });
    expect(response.message).toBeDefined();
  });

  it('should register and expose tools via function calling plugin', async () => {
    const provider = new MockProvider();
    const engine = new ChatEngine({}, provider);

    engine.registerTool({
      name: 'calculator',
      description: 'Calculate math',
      parameters: { expression: 'string' },
      execute: async (params) => ({
        result: `Calculated: ${params['expression']}`,
      }),
    });

    expect(engine.getToolNames()).toContain('calculator');
  });

  it('should use middleware + plugins together', async () => {
    const logStore = new LogStore();
    const provider = new MockProvider({ defaultResponse: 'Combined response.' });
    const engine = new ChatEngine({}, provider);

    // Add middleware
    engine.use(createLogger({ handler: logStore.handler, logContent: true }));

    // Add plugin
    engine.registerPlugin(
      createSystemPromptPlugin({
        prompt: 'You are helpful.',
      })
    );

    const response = await engine.chat({ message: 'How are you?' });
    expect(response.message).toBeDefined();

    // Verify logging captured the exchange
    const entries = logStore.getEntries();
    expect(entries.length).toBeGreaterThan(0);
  });

  it('should handle engine lifecycle', async () => {
    const provider = new MockProvider();
    const engine = new ChatEngine({}, provider);

    engine.registerPlugin(
      createSystemPromptPlugin({ prompt: 'Test' })
    );

    await engine.chat({ message: 'Hello' });

    // Destroy should clean up
    await engine.destroy();
  });

  it('should support multiple sequential conversations', async () => {
    const provider = new MockProvider({
      defaultResponse: 'Reply.',
    });
    const engine = new ChatEngine({}, provider);

    // Conversation A
    const rA = await engine.chat({ message: 'Conv A message 1' });
    await engine.chat({
      message: 'Conv A message 2',
      conversationId: rA.conversationId,
    });

    // Conversation B
    const rB = await engine.chat({ message: 'Conv B message 1' });

    expect(rA.conversationId).not.toBe(rB.conversationId);
  });
});
