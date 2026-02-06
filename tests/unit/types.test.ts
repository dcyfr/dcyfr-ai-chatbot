/**
 * Types & Schema Tests
 */

import { describe, it, expect } from 'vitest';
import {
  MessageSchema,
  MessageRoleSchema,
  TokenUsageSchema,
  ConversationSchema,
  ChatConfigSchema,
  ChatRequestSchema,
  ChatResponseSchema,
  StreamChunkSchema,
  ProviderConfigSchema,
  ContentFilterResultSchema,
  ToolCallSchema,
  ToolDefinitionSchema,
  MemoryConfigSchema,
  RateLimitConfigSchema,
} from '../../src/types/index.js';

describe('MessageRoleSchema', () => {
  it('should accept valid roles', () => {
    expect(MessageRoleSchema.parse('system')).toBe('system');
    expect(MessageRoleSchema.parse('user')).toBe('user');
    expect(MessageRoleSchema.parse('assistant')).toBe('assistant');
    expect(MessageRoleSchema.parse('tool')).toBe('tool');
  });

  it('should reject invalid roles', () => {
    expect(() => MessageRoleSchema.parse('admin')).toThrow();
    expect(() => MessageRoleSchema.parse('')).toThrow();
  });
});

describe('TokenUsageSchema', () => {
  it('should parse valid usage', () => {
    const result = TokenUsageSchema.parse({
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    });
    expect(result.totalTokens).toBe(30);
  });

  it('should reject negative values', () => {
    expect(() =>
      TokenUsageSchema.parse({
        promptTokens: -1,
        completionTokens: 0,
        totalTokens: 0,
      })
    ).toThrow();
  });
});

describe('MessageSchema', () => {
  it('should parse a valid message', () => {
    const msg = MessageSchema.parse({
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      metadata: { timestamp: Date.now() },
    });
    expect(msg.id).toBe('msg-1');
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello');
  });

  it('should parse message with optional fields', () => {
    const msg = MessageSchema.parse({
      id: 'msg-2',
      role: 'assistant',
      content: 'Hi there',
      name: 'bot',
      metadata: {
        timestamp: Date.now(),
        tokens: 5,
        model: 'gpt-4o',
        latencyMs: 100,
        finishReason: 'stop',
      },
    });
    expect(msg.name).toBe('bot');
    expect(msg.metadata.model).toBe('gpt-4o');
  });

  it('should reject message without required fields', () => {
    expect(() => MessageSchema.parse({ role: 'user' })).toThrow();
  });
});

describe('ToolCallSchema', () => {
  it('should parse a valid tool call', () => {
    const call = ToolCallSchema.parse({
      id: 'tc-1',
      name: 'get_weather',
      arguments: { city: 'NYC' },
    });
    expect(call.name).toBe('get_weather');
  });
});

describe('ToolDefinitionSchema', () => {
  it('should parse a tool definition', () => {
    const tool = ToolDefinitionSchema.parse({
      name: 'search',
      description: 'Search the web',
      parameters: { type: 'object', properties: { query: { type: 'string' } } },
    });
    expect(tool.name).toBe('search');
  });
});

describe('ConversationSchema', () => {
  it('should parse a valid conversation', () => {
    const conv = ConversationSchema.parse({
      id: 'conv-1',
      messages: [],
      metadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    expect(conv.id).toBe('conv-1');
    expect(conv.metadata.totalTokens).toBe(0);
  });
});

describe('ChatConfigSchema', () => {
  it('should apply defaults', () => {
    const config = ChatConfigSchema.parse({});
    expect(config.model).toBe('gpt-4o');
    expect(config.temperature).toBe(0.7);
    expect(config.maxTokens).toBe(4096);
    expect(config.memory.type).toBe('sliding-window');
    expect(config.streaming.enabled).toBe(true);
  });

  it('should accept custom values', () => {
    const config = ChatConfigSchema.parse({
      model: 'claude-3',
      temperature: 0.3,
      maxTokens: 2048,
    });
    expect(config.model).toBe('claude-3');
    expect(config.temperature).toBe(0.3);
  });

  it('should reject invalid temperature', () => {
    expect(() => ChatConfigSchema.parse({ temperature: 3 })).toThrow();
    expect(() => ChatConfigSchema.parse({ temperature: -1 })).toThrow();
  });
});

describe('MemoryConfigSchema', () => {
  it('should apply defaults', () => {
    const config = MemoryConfigSchema.parse({});
    expect(config.type).toBe('sliding-window');
    expect(config.windowSize).toBe(20);
    expect(config.maxTokens).toBe(8192);
  });
});

describe('RateLimitConfigSchema', () => {
  it('should apply defaults', () => {
    const config = RateLimitConfigSchema.parse({});
    expect(config.maxRequests).toBe(60);
    expect(config.strategy).toBe('token-bucket');
  });
});

describe('ChatRequestSchema', () => {
  it('should parse a minimal request', () => {
    const req = ChatRequestSchema.parse({ message: 'Hello' });
    expect(req.message).toBe('Hello');
    expect(req.stream).toBe(false);
    expect(req.role).toBe('user');
  });

  it('should reject empty message', () => {
    expect(() => ChatRequestSchema.parse({ message: '' })).toThrow();
  });
});

describe('ChatResponseSchema', () => {
  it('should parse a valid response', () => {
    const resp = ChatResponseSchema.parse({
      message: {
        id: 'msg-1',
        role: 'assistant',
        content: 'Hi',
        metadata: { timestamp: Date.now() },
      },
      conversationId: 'conv-1',
      finishReason: 'stop',
    });
    expect(resp.conversationId).toBe('conv-1');
  });
});

describe('StreamChunkSchema', () => {
  it('should parse a token chunk', () => {
    const chunk = StreamChunkSchema.parse({
      type: 'token',
      data: 'Hello',
      timestamp: Date.now(),
    });
    expect(chunk.type).toBe('token');
  });

  it('should parse a done chunk', () => {
    const chunk = StreamChunkSchema.parse({
      type: 'done',
      data: null,
      timestamp: Date.now(),
    });
    expect(chunk.type).toBe('done');
  });
});

describe('ProviderConfigSchema', () => {
  it('should apply defaults', () => {
    const config = ProviderConfigSchema.parse({});
    expect(config.type).toBe('openai');
    expect(config.model).toBe('gpt-4o');
    expect(config.maxRetries).toBe(3);
  });
});

describe('ContentFilterResultSchema', () => {
  it('should parse a safe result', () => {
    const result = ContentFilterResultSchema.parse({ safe: true, flags: [] });
    expect(result.safe).toBe(true);
  });

  it('should parse a flagged result', () => {
    const result = ContentFilterResultSchema.parse({
      safe: false,
      flags: [
        { type: 'pii', severity: 'high', match: 'email-pii' },
      ],
    });
    expect(result.flags.length).toBe(1);
  });
});
