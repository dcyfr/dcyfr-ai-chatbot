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
});
