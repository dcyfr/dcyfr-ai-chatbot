/**
 * Message handling tests
 */

import { describe, it, expect } from 'vitest';
import {
  createMessage,
  estimateTokens,
  estimateMessagesTokens,
  formatMessages,
  validateMessageContent,
  truncateMessages,
} from '../../../src/chat/message.js';

describe('createMessage', () => {
  it('should create a user message', () => {
    const msg = createMessage('user', 'Hello');
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello');
    expect(msg.id).toBeDefined();
    expect(msg.metadata.timestamp).toBeGreaterThan(0);
  });

  it('should create a message with custom options', () => {
    const msg = createMessage('assistant', 'Response', {
      id: 'custom-id',
      model: 'gpt-4o',
      tokens: 5,
      latencyMs: 100,
      finishReason: 'stop',
    });
    expect(msg.id).toBe('custom-id');
    expect(msg.metadata.model).toBe('gpt-4o');
    expect(msg.metadata.tokens).toBe(5);
    expect(msg.metadata.latencyMs).toBe(100);
  });

  it('should create a tool message', () => {
    const msg = createMessage('tool', 'result', {
      toolCallId: 'tc-1',
      toolName: 'search',
    });
    expect(msg.role).toBe('tool');
    expect(msg.metadata.toolCallId).toBe('tc-1');
    expect(msg.metadata.toolName).toBe('search');
  });
});

describe('estimateTokens', () => {
  it('should estimate tokens from text', () => {
    expect(estimateTokens('hello')).toBe(2); // 5/4 = 1.25 → ceil = 2
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('a'.repeat(100))).toBe(25);
  });
});

describe('estimateMessagesTokens', () => {
  it('should estimate tokens for a list of messages', () => {
    const messages = [
      createMessage('user', 'Hello'),
      createMessage('assistant', 'Hi there!'),
    ];
    const tokens = estimateMessagesTokens(messages);
    expect(tokens).toBeGreaterThan(0);
  });

  it('should return 0 for empty list', () => {
    expect(estimateMessagesTokens([])).toBe(0);
  });

  it('should include overhead per message', () => {
    const msg = createMessage('user', ''); // empty content
    const tokens = estimateMessagesTokens([msg]);
    expect(tokens).toBe(4); // just overhead
  });
});

describe('formatMessages', () => {
  it('should format messages for display', () => {
    const messages = [
      createMessage('user', 'Hello'),
      createMessage('assistant', 'Hi there!'),
    ];
    const formatted = formatMessages(messages);
    expect(formatted).toContain('[USER]: Hello');
    expect(formatted).toContain('[ASSISTANT]: Hi there!');
  });

  it('should include name if present', () => {
    const msg = createMessage('user', 'Hello', { name: 'Drew' });
    const formatted = formatMessages([msg]);
    expect(formatted).toContain('[USER (Drew)]: Hello');
  });
});

describe('validateMessageContent', () => {
  it('should accept valid content', () => {
    expect(validateMessageContent('Hello').valid).toBe(true);
  });

  it('should reject empty content', () => {
    const result = validateMessageContent('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('should reject whitespace-only content', () => {
    expect(validateMessageContent('   ').valid).toBe(false);
  });

  it('should reject content exceeding max length', () => {
    const result = validateMessageContent('x'.repeat(100_001));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('maximum length');
  });
});

describe('truncateMessages', () => {
  it('should return all messages when within budget', () => {
    const messages = [
      createMessage('user', 'Short message'),
    ];
    const result = truncateMessages(messages, 1000);
    expect(result.length).toBe(1);
  });

  it('should keep system messages by default', () => {
    const messages = [
      createMessage('system', 'You are helpful'),
      createMessage('user', 'Hello'),
      createMessage('assistant', 'Hi'),
      createMessage('user', 'What is AI?'),
    ];
    const result = truncateMessages(messages, 30);
    expect(result.some((m) => m.role === 'system')).toBe(true);
  });

  it('should prefer recent messages', () => {
    const messages = [
      createMessage('user', 'Old message 1'),
      createMessage('assistant', 'Old response 1'),
      createMessage('user', 'Recent message'),
    ];
    const result = truncateMessages(messages, 20);
    expect(result[result.length - 1].content).toBe('Recent message');
  });

  it('should handle empty messages', () => {
    expect(truncateMessages([], 100).length).toBe(0);
  });
});
