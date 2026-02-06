/**
 * MockProvider tests
 */

import { describe, it, expect } from 'vitest';
import { MockProvider } from '../../../src/providers/mock.js';
import { createMessage } from '../../../src/chat/message.js';

function makeRequest(content: string) {
  return {
    messages: [createMessage('user', content)],
    model: 'mock',
    temperature: 0.7,
    maxTokens: 4096,
  };
}

describe('MockProvider', () => {
  it('should return default response', async () => {
    const provider = new MockProvider();
    const result = await provider.complete(makeRequest('Hello'));
    expect(result.message.content).toBeDefined();
    expect(result.message.content.length).toBeGreaterThan(0);
  });

  it('should return trigger response', async () => {
    const provider = new MockProvider({
      responses: new Map([['weather', 'It is sunny today.']]),
    });
    const result = await provider.complete(makeRequest('What is the weather like?'));
    expect(result.message.content).toBe('It is sunny today.');
  });

  it('should fallback to default for non-matching trigger', async () => {
    const provider = new MockProvider({
      defaultResponse: 'Default answer.',
      responses: new Map([['weather', 'It is sunny today.']]),
    });
    const result = await provider.complete(makeRequest('Who are you?'));
    expect(result.message.content).toBe('Default answer.');
  });

  it('should simulate latency', async () => {
    const provider = new MockProvider({ latencyMs: 50 });
    const start = Date.now();
    await provider.complete(makeRequest('Hello'));
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });

  it('should simulate error', async () => {
    const provider = new MockProvider({ simulateErrors: true, errorRate: 1.0 });
    await expect(provider.complete(makeRequest('Hi'))).rejects.toThrow();
  });

  it('should stream tokens', async () => {
    const provider = new MockProvider({
      defaultResponse: 'Hello world',
    });

    const chunks: string[] = [];
    for await (const chunk of provider.stream(makeRequest('Hi'))) {
      if (chunk.type === 'token') {
        chunks.push(chunk.data as string);
      }
    }

    const combined = chunks.join('');
    expect(combined).toBe('Hello world');
  });

  it('should emit done chunk at end of stream', async () => {
    const provider = new MockProvider({
      defaultResponse: 'Hi',
    });

    let done = false;
    for await (const chunk of provider.stream(makeRequest('Hi'))) {
      if (chunk.type === 'done') {
        done = true;
      }
    }

    expect(done).toBe(true);
  });

  it('should count calls', async () => {
    const provider = new MockProvider();
    expect(provider.getCallCount()).toBe(0);

    await provider.complete(makeRequest('Hi'));
    expect(provider.getCallCount()).toBe(1);

    await provider.complete(makeRequest('Hey'));
    expect(provider.getCallCount()).toBe(2);
  });

  it('should reset call count', async () => {
    const provider = new MockProvider();
    await provider.complete(makeRequest('Hi'));
    expect(provider.getCallCount()).toBe(1);

    provider.resetCallCount();
    expect(provider.getCallCount()).toBe(0);
  });

  it('should include usage in response', async () => {
    const provider = new MockProvider();
    const result = await provider.complete(makeRequest('Hello'));
    expect(result.usage).toBeDefined();
    expect(result.usage.promptTokens).toBeGreaterThan(0);
    expect(result.usage.completionTokens).toBeGreaterThan(0);
    expect(result.usage.totalTokens).toBeGreaterThan(0);
  });

  it('should handle tool calls in response', async () => {
    const provider = new MockProvider({
      toolCalls: [
        {
          id: 'call-1',
          name: 'get_weather',
          arguments: { location: 'NYC' },
        },
      ],
    });

    const result = await provider.complete(makeRequest('Weather in NYC'));
    expect(result.toolCalls).toBeDefined();
    expect(result.toolCalls!.length).toBe(1);
    expect(result.toolCalls![0].name).toBe('get_weather');
  });
});
