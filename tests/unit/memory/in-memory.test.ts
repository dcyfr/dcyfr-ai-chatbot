/**
 * In-Memory Storage tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStorage } from '../../../src/memory/in-memory.js';
import { createMessage } from '../../../src/chat/message.js';

describe('InMemoryStorage', () => {
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
  });

  it('should have correct name', () => {
    expect(storage.name).toBe('in-memory');
  });

  it('should save and load messages', async () => {
    const msgs = [createMessage('user', 'Hello'), createMessage('assistant', 'Hi')];
    await storage.save('conv-1', msgs);
    const loaded = await storage.load('conv-1');
    expect(loaded.length).toBe(2);
  });

  it('should append messages on subsequent saves', async () => {
    await storage.save('conv-1', [createMessage('user', 'Hello')]);
    await storage.save('conv-1', [createMessage('assistant', 'Hi')]);
    const loaded = await storage.load('conv-1');
    expect(loaded.length).toBe(2);
  });

  it('should return empty for unknown conversation', async () => {
    expect(await storage.load('unknown')).toEqual([]);
  });

  it('should search messages', async () => {
    await storage.save('conv-1', [
      createMessage('user', 'Tell me about TypeScript'),
      createMessage('assistant', 'TypeScript is great'),
      createMessage('user', 'What about Python?'),
    ]);
    const results = await storage.search('conv-1', 'TypeScript');
    expect(results.length).toBe(2);
  });

  it('should limit search results', async () => {
    await storage.save('conv-1', [
      createMessage('user', 'Hello world'),
      createMessage('assistant', 'Hello there'),
    ]);
    const results = await storage.search('conv-1', 'hello', 1);
    expect(results.length).toBe(1);
  });

  it('should clear a conversation', async () => {
    await storage.save('conv-1', [createMessage('user', 'Hello')]);
    await storage.clear('conv-1');
    expect(await storage.load('conv-1')).toEqual([]);
  });

  it('should clear all conversations', async () => {
    await storage.save('conv-1', [createMessage('user', 'Hello')]);
    await storage.save('conv-2', [createMessage('user', 'World')]);
    await storage.clearAll();
    expect(await storage.load('conv-1')).toEqual([]);
    expect(await storage.load('conv-2')).toEqual([]);
  });

  it('should return stats', async () => {
    await storage.save('conv-1', [
      createMessage('user', 'Hello'),
      createMessage('assistant', 'Hi'),
    ]);
    const stats = await storage.getStats('conv-1');
    expect(stats.conversationId).toBe('conv-1');
    expect(stats.messageCount).toBe(2);
    expect(stats.estimatedTokens).toBeGreaterThan(0);
    expect(stats.oldestMessageTimestamp).toBeDefined();
    expect(stats.newestMessageTimestamp).toBeDefined();
  });

  it('should return getContext as all messages', async () => {
    await storage.save('conv-1', [createMessage('user', 'Hello')]);
    const context = await storage.getContext('conv-1', 1000);
    expect(context.length).toBe(1);
  });
});
