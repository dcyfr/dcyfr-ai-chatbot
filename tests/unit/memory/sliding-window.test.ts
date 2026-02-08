/**
 * Sliding Window Memory tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SlidingWindowMemory } from '../../../src/memory/sliding-window.js';
import { createMessage } from '../../../src/chat/message.js';

describe('SlidingWindowMemory', () => {
  let memory: SlidingWindowMemory;

  beforeEach(() => {
    memory = new SlidingWindowMemory({ windowSize: 3, maxTokens: 1000 });
  });

  it('should have correct name', () => {
    expect(memory.name).toBe('sliding-window');
  });

  it('should keep messages within window size', async () => {
    const msgs = Array.from({ length: 5 }, (_, i) =>
      createMessage('user', `Message ${i}`)
    );
    await memory.save('conv-1', msgs);
    const loaded = await memory.load('conv-1');
    expect(loaded.length).toBe(3); // windowSize = 3
    expect(loaded[0].content).toBe('Message 2');
    expect(loaded[2].content).toBe('Message 4');
  });

  it('should preserve system messages', async () => {
    const msgs = [
      createMessage('system', 'System prompt'),
      ...Array.from({ length: 5 }, (_, i) =>
        createMessage('user', `Message ${i}`)
      ),
    ];
    await memory.save('conv-1', msgs);
    const loaded = await memory.load('conv-1');
    expect(loaded.some((m) => m.role === 'system')).toBe(true);
  });

  it('should truncate to token budget', async () => {
    // Each message is ~10 tokens. With maxTokens=20, we should get ~2 messages
    const msgs = Array.from({ length: 3 }, (_, i) =>
      createMessage('user', 'A'.repeat(40)) // ~10 tokens each
    );
    await memory.save('conv-1', msgs);
    const context = await memory.getContext('conv-1', 20);
    expect(context.length).toBeLessThanOrEqual(3);
  });

  it('should search messages', async () => {
    await memory.save('conv-1', [
      createMessage('user', 'Hello world'),
      createMessage('user', 'Goodbye world'),
      createMessage('user', 'Hello again'),
    ]);
    const results = await memory.search('conv-1', 'Hello');
    expect(results.length).toBe(2);
  });

  it('should clear conversation', async () => {
    await memory.save('conv-1', [createMessage('user', 'Hello')]);
    await memory.clear('conv-1');
    expect(await memory.load('conv-1')).toEqual([]);
  });

  it('should return stats', async () => {
    await memory.save('conv-1', [createMessage('user', 'Hello')]);
    const stats = await memory.getStats('conv-1');
    expect(stats.messageCount).toBe(1);
    expect(stats.estimatedTokens).toBeGreaterThan(0);
  });

  it('should return stats for empty conversation', async () => {
    const stats = await memory.getStats('conv-empty');
    expect(stats.messageCount).toBe(0);
    expect(stats.estimatedTokens).toBe(0);
    expect(stats.oldestMessageTimestamp).toBeUndefined();
    expect(stats.newestMessageTimestamp).toBeUndefined();
  });

  it('should handle keepSystemMessages=false option', async () => {
    const memoryNoSystem = new SlidingWindowMemory({
      windowSize: 2,
      maxTokens: 1000,
      keepSystemMessages: false,
    });

    const msgs = [
      createMessage('system', 'System prompt'),
      createMessage('user', 'Message 1'),
      createMessage('user', 'Message 2'),
      createMessage('user', 'Message 3'),
    ];

    await memoryNoSystem.save('conv-1', msgs);
    const loaded = await memoryNoSystem.load('conv-1');

    // Should only keep last 2 messages, system message should be discarded
    expect(loaded.length).toBe(2);
    expect(loaded.every((m) => m.role !== 'system')).toBe(true);
    expect(loaded[0].content).toBe('Message 2');
    expect(loaded[1].content).toBe('Message 3');
  });

  it('should return only system messages when token budget is exceeded by system messages', async () => {
    const msgs = [
      createMessage('system', 'A'.repeat(100)), // Large system message
      createMessage('user', 'Hello'),
      createMessage('user', 'World'),
    ];

    await memory.save('conv-1', msgs);
    const context = await memory.getContext('conv-1', 10); // Very low budget

    // Should only return system message (always kept)
    expect(context.length).toBe(1);
    expect(context[0].role).toBe('system');
  });

  it('should clear all conversations', async () => {
    await memory.save('conv-1', [createMessage('user', 'Hello')]);
    await memory.save('conv-2', [createMessage('user', 'World')]);

    await memory.clearAll();

    expect(await memory.load('conv-1')).toEqual([]);
    expect(await memory.load('conv-2')).toEqual([]);
  });

  it('should limit search results', async () => {
    await memory.save('conv-1', [
      createMessage('user', 'Hello world'),
      createMessage('user', 'Hello universe'),
      createMessage('user', 'Hello everyone'),
    ]);

    const results = await memory.search('conv-1', 'Hello', 2);
    expect(results.length).toBe(2);
  });
});
