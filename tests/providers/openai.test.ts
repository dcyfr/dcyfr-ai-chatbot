/**
 * OpenAI Provider Tests
 * 
 * Comprehensive test suite for dcyfr-ai-chatbot OpenAI provider.
 * 
 * Coverage areas:
 * 1. Error handling (HTTP errors, timeouts, network failures)
 * 2. Chat completions (success, parsing, tokens)
 * 3. Streaming (SSE parsing, chunks, cleanup)
 * 4. Function calling (tools parameter, responses)
 * 5. Configuration (baseUrl, timeouts, models)
 * 
 * Target: ≥90% code coverage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OpenAIProvider } from '../../src/providers/openai.js';
import type { ProviderRequest, ProviderConfig } from '../../src/types/index.js';

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock global fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create provider with valid config', () => {
      const config: ProviderConfig = {
        apiKey: 'test-api-key',
        model: 'gpt-4',
      };

      provider = new OpenAIProvider(config);

      expect(provider).toBeDefined();
      expect(provider.name).toBe('openai');
    });

    it('should throw error when API key is missing', () => {
      const config: ProviderConfig = {
        apiKey: '',
        model: 'gpt-4',
      };

      expect(() => new OpenAIProvider(config)).toThrow('OpenAI API key is required');
    });

    it('should throw error when API key is undefined', () => {
      const config = {
        model: 'gpt-4',
      } as ProviderConfig;

      expect(() => new OpenAIProvider(config)).toThrow('OpenAI API key is required');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      const config: ProviderConfig = {
        apiKey: 'test-api-key',
        model: 'gpt-4',
      };
      provider = new OpenAIProvider(config);
    });

    it('should handle 400 Bad Request error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid request parameters',
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(provider.complete(request)).rejects.toThrow(
        'OpenAI API error (400): Invalid request parameters'
      );
    });

    it('should handle 401 Unauthorized error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key',
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(provider.complete(request)).rejects.toThrow(
        'OpenAI API error (401): Invalid API key'
      );
    });

    it('should handle 403 Forbidden error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'Access denied',
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(provider.complete(request)).rejects.toThrow(
        'OpenAI API error (403): Access denied'
      );
    });

    it('should handle 429 Rate Limit error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(provider.complete(request)).rejects.toThrow(
        'OpenAI API error (429): Rate limit exceeded'
      );
    });

    it('should handle 500 Internal Server Error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(provider.complete(request)).rejects.toThrow(
        'OpenAI API error (500): Internal server error'
      );
    });

    it('should handle 503 Service Unavailable error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'Service temporarily unavailable',
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(provider.complete(request)).rejects.toThrow(
        'OpenAI API error (503): Service temporarily unavailable'
      );
    });

    it('should handle network timeout', async () => {
      // Mock fetch to simulate timeout
      mockFetch.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Network timeout')), 100);
        });
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(provider.complete(request)).rejects.toThrow('Network timeout');
    });

    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await expect(provider.complete(request)).rejects.toThrow('Invalid JSON');
    });
  });

  describe('Chat Completions - complete()', () => {
    beforeEach(() => {
      const config: ProviderConfig = {
        apiKey: 'test-api-key',
        model: 'gpt-4',
      };
      provider = new OpenAIProvider(config);
    });

    it('should successfully complete a chat request', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        model: 'gpt-4',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you?',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const response = await provider.complete(request);

      expect(response.message.role).toBe('assistant');
      expect(response.message.content).toBe('Hello! How can I help you?');
      expect(response.usage.promptTokens).toBe(10);
      expect(response.usage.completionTokens).toBe(15);
      expect(response.usage.totalTokens).toBe(25);
      expect(response.finishReason).toBe('stop');
    });

    it('should format messages correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          model: 'gpt-4',
          choices: [
            {
              message: { role: 'assistant', content: 'Response' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      const request: ProviderRequest = {
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello', name: 'John' },
        ],
      };

      await provider.complete(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          }),
          body: expect.stringContaining('"role":"system"'),
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.messages).toHaveLength(2);
      expect(body.messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant.',
      });
      expect(body.messages[1]).toEqual({
        role: 'user',
        content: 'Hello',
        name: 'John',
      });
    });

    it('should handle finish reason mapping - stop', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          model: 'gpt-4',
          choices: [
            {
              message: { role: 'assistant', content: 'Done' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }),
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      const response = await provider.complete(request);
      expect(response.finishReason).toBe('stop');
    });

    it('should handle finish reason mapping - length', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          model: 'gpt-4',
          choices: [
            {
              message: { role: 'assistant', content: 'Truncated...' },
              finish_reason: 'length',
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 100, total_tokens: 105 },
        }),
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      const response = await provider.complete(request);
      expect(response.finishReason).toBe('length');
    });

    it('should handle finish reason mapping - tool_calls', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          model: 'gpt-4',
          choices: [
            {
              message: { role: 'assistant', content: null },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }),
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      const response = await provider.complete(request);
      expect(response.finishReason).toBe('tool_calls');
    });

    it('should handle finish reason mapping - content_filter', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          model: 'gpt-4',
          choices: [
            {
              message: { role: 'assistant', content: 'Filtered' },
              finish_reason: 'content_filter',
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }),
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      const response = await provider.complete(request);
      expect(response.finishReason).toBe('content_filter');
    });

    it('should handle null content in response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          model: 'gpt-4',
          choices: [
            {
              message: { role: 'assistant', content: null },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }),
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      const response = await provider.complete(request);
      expect(response.message.content).toBe('');
    });

    it('should use request model over config model', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          model: 'gpt-3.5-turbo',
          choices: [
            {
              message: { role: 'assistant', content: 'Response' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }),
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'gpt-3.5-turbo',
      };

      await provider.complete(request);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.model).toBe('gpt-3.5-turbo');
    });

    it('should pass temperature and maxTokens correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          model: 'gpt-4',
          choices: [
            {
              message: { role: 'assistant', content: 'Response' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }),
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        temperature: 0.8,
        maxTokens: 150,
      };

      await provider.complete(request);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.temperature).toBe(0.8);
      expect(body.max_tokens).toBe(150);
    });
  });

  describe('Streaming - stream()', () => {
    beforeEach(() => {
      const config: ProviderConfig = {
        apiKey: 'test-api-key',
        model: 'gpt-4',
      };
      provider = new OpenAIProvider(config);
    });

    it('should successfully stream chat chunks', async () => {
      const mockStreamData = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const encoder = new TextEncoder();
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: encoder.encode(mockStreamData[0]) })
          .mockResolvedValueOnce({ done: false, value: encoder.encode(mockStreamData[1]) })
          .mockResolvedValueOnce({ done: false, value: encoder.encode(mockStreamData[2]) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: vi.fn(),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const chunks: any[] = [];
      for await (const chunk of provider.stream(request)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0].type).toBe('token');
      expect(chunks[0].data).toBe('Hello');
      expect(chunks[1].type).toBe('token');
      expect(chunks[1].data).toBe(' world');
      expect(chunks[2].type).toBe('done');
      expect(mockReader.releaseLock).toHaveBeenCalled();
    });

    it('should handle [DONE] signal correctly', async () => {
      const mockStreamData = [
        'data: {"choices":[{"delta":{"content":"Test"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const encoder = new TextEncoder();
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: encoder.encode(mockStreamData[0]) })
          .mockResolvedValueOnce({ done: false, value: encoder.encode(mockStreamData[1]) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: vi.fn(),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      const chunks: any[] = [];
      for await (const chunk of provider.stream(request)) {
        chunks.push(chunk);
      }

      expect(chunks[chunks.length - 1].type).toBe('done');
    });

    it('should skip malformed JSON lines gracefully', async () => {
      const mockStreamData = [
        'data: {"choices":[{"delta":{"content":"Valid"}}]}\n\n',
        'data: {invalid json}\n\n',
        'data: {"choices":[{"delta":{"content":"Also valid"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const encoder = new TextEncoder();
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: encoder.encode(mockStreamData.join('')) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: vi.fn(),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      const chunks: any[] = [];
      for await (const chunk of provider.stream(request)) {
        chunks.push(chunk);
      }

      // Should have 2 token chunks + 1 done chunk (malformed JSON skipped)
      const tokenChunks = chunks.filter((c) => c.type === 'token');
      expect(tokenChunks).toHaveLength(2);
      expect(tokenChunks[0].data).toBe('Valid');
      expect(tokenChunks[1].data).toBe('Also valid');
    });

    it('should handle empty delta content', async () => {
      const mockStreamData = [
        'data: {"choices":[{"delta":{}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"Test"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const encoder = new TextEncoder();
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: encoder.encode(mockStreamData.join('')) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: vi.fn(),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      const chunks: any[] = [];
      for await (const chunk of provider.stream(request)) {
        chunks.push(chunk);
      }

      const tokenChunks = chunks.filter((c) => c.type === 'token');
      expect(tokenChunks).toHaveLength(1);
      expect(tokenChunks[0].data).toBe('Test');
    });

    it('should yield error chunk when no response body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        body: null,
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      const chunks: any[] = [];
      for await (const chunk of provider.stream(request)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('error');
      expect(chunks[0].data).toBe('No response body for streaming');
    });

    it('should release lock when stream ends normally', async () => {
      const mockStreamData = ['data: [DONE]\n\n'];

      const encoder = new TextEncoder();
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: encoder.encode(mockStreamData[0]) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: vi.fn(),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      const chunks: any[] = [];
      for await (const chunk of provider.stream(request)) {
        chunks.push(chunk);
      }

      expect(mockReader.releaseLock).toHaveBeenCalled();
    });

    it('should set stream parameter to true in request', async () => {
      const mockReader = {
        read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        releaseLock: vi.fn(),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      for await (const _chunk of provider.stream(request)) {
        // Consume stream
      }

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.stream).toBe(true);
    });
  });

  describe('Function Calling', () => {
    beforeEach(() => {
      const config: ProviderConfig = {
        apiKey: 'test-api-key',
        model: 'gpt-4',
      };
      provider = new OpenAIProvider(config);
    });

    it('should format tools parameter correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          model: 'gpt-4',
          choices: [
            {
              message: { role: 'assistant', content: 'Response' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }),
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'What is the weather?' }],
        tools: [
          {
            name: 'get_weather',
            description: 'Get current weather for a location',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
              required: ['location'],
            },
          },
        ],
      };

      await provider.complete(request);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.tools).toHaveLength(1);
      expect(body.tools[0]).toEqual({
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get current weather for a location',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string' },
            },
            required: ['location'],
          },
        },
      });
    });

    it('should handle multiple tools', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          model: 'gpt-4',
          choices: [
            {
              message: { role: 'assistant', content: 'Response' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }),
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        tools: [
          {
            name: 'tool1',
            description: 'First tool',
            parameters: { type: 'object', properties: {} },
          },
          {
            name: 'tool2',
            description: 'Second tool',
            parameters: { type: 'object', properties: {} },
          },
        ],
      };

      await provider.complete(request);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.tools).toHaveLength(2);
      expect(body.tools[0].function.name).toBe('tool1');
      expect(body.tools[1].function.name).toBe('tool2');
    });

    it('should not include tools parameter when tools array is empty', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          model: 'gpt-4',
          choices: [
            {
              message: { role: 'assistant', content: 'Response' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }),
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        tools: [],
      };

      await provider.complete(request);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.tools).toBeUndefined();
    });
  });

  describe('Configuration', () => {
    it('should use custom baseUrl when provided', async () => {
      const config: ProviderConfig = {
        apiKey: 'test-api-key',
        model: 'gpt-4',
        baseUrl: 'https://custom.openai.example.com/v1',
      };
      provider = new OpenAIProvider(config);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          model: 'gpt-4',
          choices: [
            {
              message: { role: 'assistant', content: 'Response' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }),
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      await provider.complete(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.openai.example.com/v1/chat/completions',
        expect.any(Object)
      );
    });

    it('should use default OpenAI baseUrl when not provided', async () => {
      const config: ProviderConfig = {
        apiKey: 'test-api-key',
        model: 'gpt-4',
      };
      provider = new OpenAIProvider(config);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          model: 'gpt-4',
          choices: [
            {
              message: { role: 'assistant', content: 'Response' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }),
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      await provider.complete(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.any(Object)
      );
    });

    it('should use custom timeout when provided', async () => {
      const config: ProviderConfig = {
        apiKey: 'test-api-key',
        model: 'gpt-4',
        timeoutMs: 5000,
      };
      provider = new OpenAIProvider(config);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          model: 'gpt-4',
          choices: [
            {
              message: { role: 'assistant', content: 'Response' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }),
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      await provider.complete(request);

      const callArgs = mockFetch.mock.calls[0];
      // Timeout should be set via AbortSignal.timeout(5000)
      expect(callArgs[1].signal).toBeDefined();
    });

    it('should use default 30s timeout when not provided', async () => {
      const config: ProviderConfig = {
        apiKey: 'test-api-key',
        model: 'gpt-4',
      };
      provider = new OpenAIProvider(config);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          model: 'gpt-4',
          choices: [
            {
              message: { role: 'assistant', content: 'Response' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }),
      });

      const request: ProviderRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      await provider.complete(request);

      const callArgs = mockFetch.mock.calls[0];
      // Default timeout should be set via AbortSignal.timeout(30000)
      expect(callArgs[1].signal).toBeDefined();
    });
  });
});
