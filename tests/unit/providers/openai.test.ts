/**
 * OpenAI Provider Tests
 *
 * Tests for OpenAI-compatible provider with mocked fetch API
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OpenAIProvider } from '../../../src/providers/openai.js';
import { createMessage } from '../../../src/chat/message.js';
import type { ProviderRequest } from '../../../src/types/index.js';

// Helper to create test requests
function makeRequest(content: string, options: Partial<ProviderRequest> = {}): ProviderRequest {
  return {
    messages: [createMessage('user', content)],
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
    ...options,
  };
}

// Mock OpenAI API responses
const mockSuccessResponse = {
  id: 'chatcmpl-123',
  model: 'gpt-4o',
  choices: [
    {
      message: {
        role: 'assistant',
        content: 'Hello! How can I help you today?',
      },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 20,
    total_tokens: 30,
  },
};

const mockToolCallsResponse = {
  id: 'chatcmpl-456',
  model: 'gpt-4o',
  choices: [
    {
      message: {
        role: 'assistant',
        content: null,
      },
      finish_reason: 'tool_calls',
    },
  ],
  usage: {
    prompt_tokens: 15,
    completion_tokens: 10,
    total_tokens: 25,
  },
};

// Mock streaming chunks (SSE format)
function createMockStreamChunks(tokens: string[]): string {
  const chunks = tokens.map(
    (content) =>
      `data: ${JSON.stringify({
        choices: [
          {
            delta: { content },
            finish_reason: null,
          },
        ],
      })}\n\n`
  );
  chunks.push('data: [DONE]\n\n');
  return chunks.join('');
}

describe('OpenAIProvider', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Mock global fetch
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('Constructor', () => {
    it('should create provider with API key', () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      expect(provider.name).toBe('openai');
    });

    it('should throw if API key is missing', () => {
      expect(() => new OpenAIProvider({} as any)).toThrow('OpenAI API key is required');
    });

    it('should accept custom base URL', () => {
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        baseUrl: 'https://custom.api.com/v1',
      });
      expect(provider.name).toBe('openai');
    });

    it('should accept timeout configuration', () => {
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        timeoutMs: 60000,
      });
      expect(provider.name).toBe('openai');
    });
  });

  describe('complete() - Non-streaming', () => {
    it('should complete chat successfully', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockSuccessResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const result = await provider.complete(makeRequest('Hello'));

      expect(result.message.role).toBe('assistant');
      expect(result.message.content).toBe('Hello! How can I help you today?');
      expect(result.usage.promptTokens).toBe(10);
      expect(result.usage.completionTokens).toBe(20);
      expect(result.usage.totalTokens).toBe(30);
      expect(result.finishReason).toBe('stop');
    });

    it('should send correct request to OpenAI API', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockSuccessResponse), { status: 200 })
      );

      const provider = new OpenAIProvider({ apiKey: 'test-api-key' });
      await provider.complete(makeRequest('Hello'));

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          },
          body: expect.stringContaining('"stream":false'),
        })
      );
    });

    it('should use custom base URL if provided', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockSuccessResponse), { status: 200 })
      );

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        baseUrl: 'https://custom.api.com/v1',
      });
      await provider.complete(makeRequest('Hello'));

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://custom.api.com/v1/chat/completions',
        expect.anything()
      );
    });

    it('should handle tool calls in request', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockToolCallsResponse), { status: 200 })
      );

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const request = makeRequest('Get weather', {
        tools: [
          {
            name: 'get_weather',
            description: 'Get current weather',
            parameters: {
              type: 'object',
              properties: { location: { type: 'string' } },
              required: ['location'],
            },
          },
        ],
      });

      await provider.complete(request);

      const callBody = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
      expect(callBody.tools).toBeDefined();
      expect(callBody.tools[0].function.name).toBe('get_weather');
    });

    it('should map finish reasons correctly', async () => {
      const testCases = [
        { openai: 'stop', expected: 'stop' },
        { openai: 'length', expected: 'length' },
        { openai: 'tool_calls', expected: 'tool_calls' },
        { openai: 'function_call', expected: 'tool_calls' },
        { openai: 'content_filter', expected: 'content_filter' },
        { openai: 'unknown_reason', expected: 'stop' }, // Fallback
      ];

      for (const testCase of testCases) {
        fetchSpy.mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              ...mockSuccessResponse,
              choices: [
                {
                  ...mockSuccessResponse.choices[0],
                  finish_reason: testCase.openai,
                },
              ],
            }),
            { status: 200 }
          )
        );

        const provider = new OpenAIProvider({ apiKey: 'test-key' });
        const result = await provider.complete(makeRequest('Test'));
        expect(result.finishReason).toBe(testCase.expected);
      }
    });

    it('should handle null content in response', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...mockSuccessResponse,
            choices: [
              {
                message: { role: 'assistant', content: null },
                finish_reason: 'stop',
              },
            ],
          }),
          { status: 200 }
        )
      );

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const result = await provider.complete(makeRequest('Test'));
      expect(result.message.content).toBe('');
    });

    it('should handle missing usage in response', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'test',
            model: 'gpt-4o',
            choices: [
              {
                message: { role: 'assistant', content: 'Hi' },
                finish_reason: 'stop',
              },
            ],
            // No usage field
          }),
          { status: 200 }
        )
      );

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const result = await provider.complete(makeRequest('Test'));
      expect(result.usage.promptTokens).toBe(0);
      expect(result.usage.completionTokens).toBe(0);
      expect(result.usage.totalTokens).toBe(0);
    });
  });

  describe('Error Handling - complete()', () => {
    it('should throw on HTTP 400 error', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response('Invalid request', {
          status: 400,
          statusText: 'Bad Request',
        })
      );

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      await expect(provider.complete(makeRequest('Test'))).rejects.toThrow(
        'OpenAI API error (400):'
      );
    });

    it('should throw on HTTP 401 error (invalid API key)', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response('Invalid API key', {
          status: 401,
          statusText: 'Unauthorized',
        })
      );

      const provider = new OpenAIProvider({ apiKey: 'bad-key' });
      await expect(provider.complete(makeRequest('Test'))).rejects.toThrow(
        'OpenAI API error (401):'
      );
    });

    it('should throw on HTTP 429 error (rate limit)', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response('Rate limit exceeded', {
          status: 429,
          statusText: 'Too Many Requests',
        })
      );

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      await expect(provider.complete(makeRequest('Test'))).rejects.toThrow(
        'OpenAI API error (429):'
      );
    });

    it('should throw on HTTP 500 error (server error)', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response('Internal server error', {
          status: 500,
          statusText: 'Internal Server Error',
        })
      );

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      await expect(provider.complete(makeRequest('Test'))).rejects.toThrow(
        'OpenAI API error (500):'
      );
    });

    it('should throw on network error', async () => {
      fetchSpy.mockRejectedValueOnce(new TypeError('Network request failed'));

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      await expect(provider.complete(makeRequest('Test'))).rejects.toThrow('Network request failed');
    });

    it('should respect timeout configuration', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockSuccessResponse), { status: 200 })
      );

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        timeoutMs: 5000,
      });

      await provider.complete(makeRequest('Test'));

      const callOptions = fetchSpy.mock.calls[0][1] as RequestInit;
      // Note: AbortSignal.timeout creates a signal, we can't easily test the exact timeout value
      // but we can verify a signal was passed
      expect(callOptions.signal).toBeDefined();
    });
  });

  describe('stream() - Streaming Responses', () => {
    it('should stream tokens successfully', async () => {
      const streamData = createMockStreamChunks(['Hello', ' ', 'world', '!']);
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(streamData));
          controller.close();
        },
      });

      fetchSpy.mockResolvedValueOnce(
        new Response(mockStream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      );

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const chunks: string[] = [];

      for await (const chunk of provider.stream(makeRequest('Test'))) {
        if (chunk.type === 'token') {
          chunks.push(chunk.data as string);
        }
      }

      expect(chunks.join('')).toBe('Hello world!');
    });

    it('should emit done chunk at end of stream', async () => {
      const streamData = createMockStreamChunks(['Hi']);
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(streamData));
          controller.close();
        },
      });

      fetchSpy.mockResolvedValueOnce(
        new Response(mockStream, { status: 200 })
      );

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      let doneCount = 0;

      for await (const chunk of provider.stream(makeRequest('Test'))) {
        if (chunk.type === 'done') {
          doneCount++;
        }
      }

      expect(doneCount).toBe(1);
    });

    it('should send stream:true in request body', async () => {
      const streamData = createMockStreamChunks(['Test']);
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(streamData));
          controller.close();
        },
      });

      fetchSpy.mockResolvedValueOnce(
        new Response(mockStream, { status: 200 })
      );

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const iterator = provider.stream(makeRequest('Test'));
      await iterator.next(); // Consume first chunk to trigger fetch

      const callBody = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
      expect(callBody.stream).toBe(true);
    });

    it('should handle malformed JSON in stream', async () => {
      const streamData = 'data: {invalid json}\n\ndata: [DONE]\n\n';
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(streamData));
          controller.close();
        },
      });

      fetchSpy.mockResolvedValueOnce(
        new Response(mockStream, { status: 200 })
      );

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const chunks: any[] = [];

      for await (const chunk of provider.stream(makeRequest('Test'))) {
        chunks.push(chunk);
      }

      // Should skip malformed JSON and only return done chunk
      expect(chunks.length).toBe(1);
      expect(chunks[0].type).toBe('done');
    });

    it('should handle empty lines in stream', async () => {
      const streamData = '\n\ndata: {"choices":[{"delta":{"content":"Hi"},"finish_reason":null}]}\n\n\n\ndata: [DONE]\n\n';
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(streamData));
          controller.close();
        },
      });

      fetchSpy.mockResolvedValueOnce(
        new Response(mockStream, { status: 200 })
      );

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const chunks: any[] = [];

      for await (const chunk of provider.stream(makeRequest('Test'))) {
        if (chunk.type === 'token') {
          chunks.push(chunk.data);
        }
      }

      expect(chunks.join('')).toBe('Hi');
    });

    it('should handle lines without "data:" prefix', async () => {
      const streamData = ': comment line\ndata: {"choices":[{"delta":{"content":"Test"},"finish_reason":null}]}\n\ndata: [DONE]\n\n';
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(streamData));
          controller.close();
        },
      });

      fetchSpy.mockResolvedValueOnce(
        new Response(mockStream, { status: 200 })
      );

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const chunks: any[] = [];

      for await (const chunk of provider.stream(makeRequest('Test'))) {
        if (chunk.type === 'token') {
          chunks.push(chunk.data);
        }
      }

      expect(chunks.join('')).toBe('Test');
    });

    it('should handle chunks without content', async () => {
      const streamData = 'data: {"choices":[{"delta":{},"finish_reason":null}]}\n\ndata: {"choices":[{"delta":{"content":"Hi"},"finish_reason":null}]}\n\ndata: [DONE]\n\n';
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(streamData));
          controller.close();
        },
      });

      fetchSpy.mockResolvedValueOnce(
        new Response(mockStream, { status: 200 })
      );

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const chunks: any[] = [];

      for await (const chunk of provider.stream(makeRequest('Test'))) {
        if (chunk.type === 'token') {
          chunks.push(chunk.data);
        }
      }

      expect(chunks.join('')).toBe('Hi');
    });

    it('should release reader lock on stream completion', async () => {
      const streamData = createMockStreamChunks(['Test']);
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(streamData));
          controller.close();
        },
      });

      fetchSpy.mockResolvedValueOnce(
        new Response(mockStream, { status: 200 })
      );

      const provider = new OpenAIProvider({ apiKey: 'test-key' });

      for await (const _chunk of provider.stream(makeRequest('Test'))) {
        // Consume all chunks
      }

      // If reader wasn't released, this would hang or error
      // No assertion needed - successful completion proves lock was released
    });
  });

  describe('Error Handling - stream()', () => {
    it('should emit error chunk if no response body', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(null, { status: 200 })
      );

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const chunks: any[] = [];

      for await (const chunk of provider.stream(makeRequest('Test'))) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(1);
      expect(chunks[0].type).toBe('error');
      expect(chunks[0].data).toBe('No response body for streaming');
    });

    it('should throw on HTTP error before streaming starts', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response('API error', { status: 401 })
      );

      const provider = new OpenAIProvider({ apiKey: 'bad-key' });
      const iterator = provider.stream(makeRequest('Test'));

      await expect(iterator.next()).rejects.toThrow('OpenAI API error (401):');
    });

    it('should release reader lock on error', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.error(new Error('Stream error'));
        },
      });

      fetchSpy.mockResolvedValueOnce(
        new Response(mockStream, { status: 200 })
      );

      const provider = new OpenAIProvider({ apiKey: 'test-key' });

      try {
        for await (const _chunk of provider.stream(makeRequest('Test'))) {
          // Should error during iteration
        }
      } catch (error) {
        // Expected error
        expect(error).toBeInstanceOf(Error);
      }

      // If reader wasn't released in finally block, this test would hang
    });
  });

  describe('Request Configuration', () => {
    it('should include message name if provided', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockSuccessResponse), { status: 200 })
      );

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      const messageWithName = createMessage('user', 'Hello', { name: 'Alice' });

      await provider.complete({
        messages: [messageWithName],
        model: 'gpt-4o',
      });

      const callBody = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
      expect(callBody.messages[0].name).toBe('Alice');
    });

    it('should omit message name if not provided', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockSuccessResponse), { status: 200 })
      );

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      await provider.complete(makeRequest('Hello'));

      const callBody = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
      expect(callBody.messages[0].name).toBeUndefined();
    });

    it('should use default timeout if not specified', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockSuccessResponse), { status: 200 })
      );

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      await provider.complete(makeRequest('Test'));

      // Default timeout is 30000ms
      const callOptions = fetchSpy.mock.calls[0][1] as RequestInit;
      expect(callOptions.signal).toBeDefined();
    });

    it('should not include tools if none provided', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockSuccessResponse), { status: 200 })
      );

      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      await provider.complete(makeRequest('Test'));

      const callBody = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
      expect(callBody.tools).toBeUndefined();
    });

    it('should use provider config model if request model not specified', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockSuccessResponse), { status: 200 })
      );

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
      });

      const request = makeRequest('Test');
      delete request.model; // Remove model from request

      await provider.complete(request);

      const callBody = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
      expect(callBody.model).toBe('gpt-3.5-turbo');
    });

    it('should prioritize request model over config model', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockSuccessResponse), { status: 200 })
      );

      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        model: 'gpt-3.5-turbo',
      });

      await provider.complete(makeRequest('Test', { model: 'gpt-4o' }));

      const callBody = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
      expect(callBody.model).toBe('gpt-4o');
    });
  });
});
