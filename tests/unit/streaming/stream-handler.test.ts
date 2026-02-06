/**
 * Stream Handler tests
 */

import { describe, it, expect } from 'vitest';
import {
  formatSSE,
  createStreamChunk,
  StreamCollector,
  StreamHandler,
} from '../../../src/streaming/stream-handler.js';

describe('formatSSE', () => {
  it('should format a chunk as SSE', () => {
    const chunk = createStreamChunk('token', 'Hello');
    const sse = formatSSE(chunk);
    expect(sse).toContain('event: token');
    expect(sse).toContain('data: ');
    expect(sse).toContain('"Hello"');
    expect(sse).toMatch(/\n\n$/);
  });

  it('should format a done chunk', () => {
    const chunk = createStreamChunk('done', null);
    const sse = formatSSE(chunk);
    expect(sse).toContain('event: done');
  });
});

describe('createStreamChunk', () => {
  it('should create a token chunk', () => {
    const chunk = createStreamChunk('token', 'word');
    expect(chunk.type).toBe('token');
    expect(chunk.data).toBe('word');
    expect(chunk.timestamp).toBeGreaterThan(0);
  });

  it('should include metadata', () => {
    const chunk = createStreamChunk('metadata', { key: 'value' }, { model: 'gpt-4o' });
    expect(chunk.metadata).toEqual({ model: 'gpt-4o' });
  });
});

describe('StreamCollector', () => {
  it('should accumulate token chunks', () => {
    const collector = new StreamCollector();
    collector.add(createStreamChunk('token', 'Hello'));
    collector.add(createStreamChunk('token', ' world'));
    expect(collector.getContent()).toBe('Hello world');
    expect(collector.count).toBe(2);
  });

  it('should detect done', () => {
    const collector = new StreamCollector();
    collector.add(createStreamChunk('token', 'Hi'));
    expect(collector.done).toBe(false);
    collector.add(createStreamChunk('done', null));
    expect(collector.done).toBe(true);
  });

  it('should detect errors', () => {
    const collector = new StreamCollector();
    collector.add(createStreamChunk('error', 'Something failed'));
    expect(collector.error).toBeDefined();
    expect(collector.error!.message).toBe('Something failed');
  });

  it('should return all chunks', () => {
    const collector = new StreamCollector();
    collector.add(createStreamChunk('token', 'A'));
    collector.add(createStreamChunk('token', 'B'));
    expect(collector.getChunks().length).toBe(2);
  });

  it('should reset state', () => {
    const collector = new StreamCollector();
    collector.add(createStreamChunk('token', 'Hello'));
    collector.add(createStreamChunk('done', null));
    collector.reset();
    expect(collector.getContent()).toBe('');
    expect(collector.done).toBe(false);
    expect(collector.count).toBe(0);
  });
});

describe('StreamHandler', () => {
  it('should handle a stream', async () => {
    const handler = new StreamHandler(0);
    const chunks = [
      createStreamChunk('token', 'Hello'),
      createStreamChunk('token', ' World'),
      createStreamChunk('done', null),
    ];

    async function* source() {
      for (const chunk of chunks) {
        yield chunk;
      }
    }

    const collected: string[] = [];
    for await (const chunk of handler.handle(source())) {
      if (chunk.type === 'token' && typeof chunk.data === 'string') {
        collected.push(chunk.data);
      }
    }
    expect(collected.join('')).toBe('Hello World');
  });

  it('should call onChunk callbacks', async () => {
    const handler = new StreamHandler(0);
    const received: string[] = [];

    handler.onChunk((chunk) => {
      if (chunk.type === 'token' && typeof chunk.data === 'string') {
        received.push(chunk.data);
      }
    });

    async function* source() {
      yield createStreamChunk('token', 'Test');
      yield createStreamChunk('done', null);
    }

    for await (const _ of handler.handle(source())) {
      // consume
    }

    expect(received).toEqual(['Test']);
  });

  it('should call onDone callback', async () => {
    const handler = new StreamHandler(0);
    let doneCalled = false;
    handler.onDone(() => { doneCalled = true; });

    async function* source() {
      yield createStreamChunk('done', null);
    }

    for await (const _ of handler.handle(source())) {
      // consume
    }
    expect(doneCalled).toBe(true);
  });

  it('should abort stream', async () => {
    const handler = new StreamHandler(0);

    async function* source() {
      yield createStreamChunk('token', 'A');
      yield createStreamChunk('token', 'B');
      yield createStreamChunk('token', 'C');
    }

    const collected: string[] = [];
    handler.abort();

    for await (const chunk of handler.handle(source())) {
      if (chunk.type === 'token' && typeof chunk.data === 'string') {
        collected.push(chunk.data);
      }
    }
    expect(collected.length).toBe(0);
  });
});
