/**
 * Summary Memory tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SummaryMemory } from '../../../src/memory/summary.js';
import { createMessage } from '../../../src/chat/message.js';

describe('SummaryMemory', () => {
  let memory: SummaryMemory;

  beforeEach(() => {
    memory = new SummaryMemory({
      recentCount: 2,
      maxSummaryTokens: 100,
    });
  });

  it('should have correct name', () => {
    expect(memory.name).toBe('summary');
  });

  it('should keep recent messages when under threshold', async () => {
    await memory.save('conv-1', [
      createMessage('user', 'Hello'),
      createMessage('assistant', 'Hi'),
    ]);
    const loaded = await memory.load('conv-1');
    expect(loaded.length).toBe(2);
  });

  it('should summarize older messages', async () => {
    const msgs = Array.from({ length: 5 }, (_, i) =>
      createMessage(i % 2 === 0 ? 'user' : 'assistant', `Message ${i}`)
    );
    await memory.save('conv-1', msgs);

    const loaded = await memory.load('conv-1');
    // Should have summary + 2 recent messages
    expect(loaded.length).toBe(3); // 1 summary + 2 recent
    expect(loaded[0].content).toContain('Previous conversation summary');
  });

  it('should provide summary via getSummary', async () => {
    const msgs = Array.from({ length: 5 }, (_, i) =>
      createMessage('user', `Message ${i}`)
    );
    await memory.save('conv-1', msgs);
    const summary = memory.getSummary('conv-1');
    expect(summary).toBeDefined();
  });

  it('should search in messages and summary', async () => {
    const msgs = [
      createMessage('user', 'TypeScript is great'),
      createMessage('assistant', 'Indeed it is'),
      createMessage('user', 'Tell me more about TypeScript'),
    ];
    // Save enough to trigger summarization (recentCount = 2)
    await memory.save('conv-1', msgs);
    const results = await memory.search('conv-1', 'TypeScript');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should clear conversation and summary', async () => {
    await memory.save('conv-1', [
      createMessage('user', 'A'),
      createMessage('user', 'B'),
      createMessage('user', 'C'),
    ]);
    await memory.clear('conv-1');
    expect(await memory.load('conv-1')).toEqual([]);
    expect(memory.getSummary('conv-1')).toBeUndefined();
  });

  it('should return stats including summary tokens', async () => {
    const msgs = Array.from({ length: 4 }, (_, i) =>
      createMessage('user', `Message ${i}`)
    );
    await memory.save('conv-1', msgs);
    const stats = await memory.getStats('conv-1');
    expect(stats.estimatedTokens).toBeGreaterThan(0);
  });

  it('should use custom summarizer', async () => {
    const customMemory = new SummaryMemory({
      recentCount: 1,
      maxSummaryTokens: 50,
      summarizer: async (msgs) => `Custom summary: ${msgs.length} messages`,
    });

    await customMemory.save('conv-1', [
      createMessage('user', 'A'),
      createMessage('user', 'B'),
      createMessage('user', 'C'),
    ]);

    const summary = customMemory.getSummary('conv-1');
    expect(summary).toContain('Custom summary');
  });

  it('should return stats for empty conversation', async () => {
    const stats = await memory.getStats('non-existent');
    
    expect(stats.conversationId).toBe('non-existent');
    expect(stats.messageCount).toBe(0);
    expect(stats.estimatedTokens).toBe(0);
    expect(stats.oldestMessageTimestamp).toBeUndefined();
    expect(stats.newestMessageTimestamp).toBeUndefined();
  });

  it('should limit search results', async () => {
    await memory.save('conv-1', [
      createMessage('user', 'test message 1'),
      createMessage('user', 'test message 2'),
      createMessage('user', 'test message 3'),
      createMessage('user', 'test message 4'),
    ]);
    
    const results = await memory.search('conv-1', 'test', 2);
    expect(results).toHaveLength(2);
  });

  it('should clear all conversations', async () => {
    await memory.save('conv-1', [createMessage('user', 'Message 1')]);
    await memory.save('conv-2', [createMessage('user', 'Message 2')]);
    
    await memory.clearAll();
    
    const context1 = await memory.getContext('conv-1');
    const context2 = await memory.getContext('conv-2');
    expect(context1).toHaveLength(0);
    expect(context2).toHaveLength(0);
  });

  it('should handle token truncation with summary preserved', async () => {
    const smallTokenMemory = new SummaryMemory({ recentCount: 2, maxTokens: 50 });
    
    // Add messages to trigger summarization and truncation
    await smallTokenMemory.save('conv-1', [createMessage('user', 'A'.repeat(100))]);
    await smallTokenMemory.save('conv-1', [createMessage('assistant', 'B'.repeat(100))]);
    await smallTokenMemory.save('conv-1', [createMessage('user', 'C'.repeat(100))]);
    
    // getContext should apply token truncation
    const context = await smallTokenMemory.getContext('conv-1');
    
    // Should have some messages, but truncated to fit maxTokens
    expect(context.length).toBeGreaterThan(0);
    const summary = smallTokenMemory.getSummary('conv-1');
    expect(summary).toBeDefined();
  });

  it('should truncate long content in default summarizer', async () => {
    const memory2 = new SummaryMemory({ recentCount: 1 });
    
    // Create a very long message to trigger truncation in default summarizer
    const longContent = 'A'.repeat(600);
    await memory2.save('conv-1', [createMessage('user', longContent)]);
    await memory2.save('conv-1', [createMessage('user', 'Trigger summarization')]);
    
    const summary = memory2.getSummary('conv-1');
    expect(summary).toBeDefined();
    expect(summary!.length).toBeLessThanOrEqual(500);
    expect(summary).toContain('...');
  });

  it('should search in non-existent conversation', async () => {
    const results = await memory.search('non-existent', 'query');
    expect(results).toHaveLength(0);
  });
});
