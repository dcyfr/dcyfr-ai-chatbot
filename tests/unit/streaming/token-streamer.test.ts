/**
 * Token Streamer tests
 */

import { describe, it, expect } from 'vitest';
import {
  TokenStreamer,
  transformStream,
  filterStream,
  collectStream,
} from '../../../src/streaming/token-streamer.js';
import { createStreamChunk } from '../../../src/streaming/stream-handler.js';

describe('TokenStreamer', () => {
  it('should emit tokens when buffer is full', () => {
    const streamer = new TokenStreamer({ bufferSize: 5, flushIntervalMs: 10000 });
    const chunks = streamer.write('Hello World');
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should flush remaining content', () => {
    const streamer = new TokenStreamer({ bufferSize: 100 });
    streamer.write('Hi');
    const chunks = streamer.flush();
    expect(chunks.length).toBe(1);
    expect(chunks[0].data).toBe('Hi');
  });

  it('should return empty flush when no buffer', () => {
    const streamer = new TokenStreamer();
    expect(streamer.flush()).toEqual([]);
  });

  it('should create done chunk', () => {
    const streamer = new TokenStreamer();
    const done = streamer.done({ model: 'test' });
    expect(done.type).toBe('done');
    expect(done.metadata).toEqual({ model: 'test' });
  });

  it('should create error chunk', () => {
    const streamer = new TokenStreamer();
    streamer.write('buffered');
    const error = streamer.error('Something failed');
    expect(error.type).toBe('error');
    expect(error.data).toBe('Something failed');
    expect(streamer.getBuffer()).toBe('');
  });

  it('should call onEmit callback', () => {
    const emitted: string[] = [];
    const streamer = new TokenStreamer({ bufferSize: 1 });
    streamer.onEmit((chunk) => {
      if (typeof chunk.data === 'string') {
        emitted.push(chunk.data);
      }
    });
    streamer.write('Test data');
    expect(emitted.length).toBeGreaterThan(0);
  });

  it('should handle word boundary mode', () => {
    const streamer = new TokenStreamer({ bufferSize: 5, wordBoundary: true });
    const chunks = streamer.write('Hello World Test');
    // Should split at word boundaries
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should reset state', () => {
    const streamer = new TokenStreamer();
    streamer.write('buffered');
    streamer.reset();
    expect(streamer.getBuffer()).toBe('');
  });

  it('should get current buffer', () => {
    const streamer = new TokenStreamer({ bufferSize: 100 });
    streamer.write('test');
    expect(streamer.getBuffer()).toBe('test');
  });
});

describe('transformStream', () => {
  it('should transform chunks', async () => {
    async function* source() {
      yield createStreamChunk('token', 'hello');
      yield createStreamChunk('token', 'world');
    }

    const chunks = await collectStream(
      transformStream(source(), (chunk) => ({
        ...chunk,
        data: typeof chunk.data === 'string' ? chunk.data.toUpperCase() : chunk.data,
      }))
    );

    expect(chunks[0].data).toBe('HELLO');
    expect(chunks[1].data).toBe('WORLD');
  });

  it('should filter out null transforms', async () => {
    async function* source() {
      yield createStreamChunk('token', 'keep');
      yield createStreamChunk('metadata', {});
      yield createStreamChunk('token', 'also keep');
    }

    const chunks = await collectStream(
      transformStream(source(), (chunk) =>
        chunk.type === 'token' ? chunk : null
      )
    );

    expect(chunks.length).toBe(2);
  });
});

describe('filterStream', () => {
  it('should filter by type', async () => {
    async function* source() {
      yield createStreamChunk('token', 'A');
      yield createStreamChunk('metadata', {});
      yield createStreamChunk('token', 'B');
      yield createStreamChunk('done', null);
    }

    const chunks = await collectStream(
      filterStream(source(), ['token'])
    );

    expect(chunks.length).toBe(2);
    expect(chunks.every((c) => c.type === 'token')).toBe(true);
  });
});

describe('collectStream', () => {
  it('should collect all chunks', async () => {
    async function* source() {
      yield createStreamChunk('token', 'A');
      yield createStreamChunk('token', 'B');
      yield createStreamChunk('done', null);
    }

    const chunks = await collectStream(source());
    expect(chunks.length).toBe(3);
  });
});
