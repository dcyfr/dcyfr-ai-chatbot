/**
 * Stream Handler - Branch coverage tests
 */

import { describe, it, expect } from 'vitest';
import {
  formatSSE,
  createStreamChunk,
  StreamCollector,
} from '../../../src/streaming/stream-handler.js';

describe('StreamHandler - Branch Coverage', () => {
  describe('formatSSE', () => {
    it('should format token chunks', () => {
      const chunk = createStreamChunk('token', 'Hello');
      const sse = formatSSE(chunk);
      expect(sse).toContain('event: token');
      expect(sse).toContain('data:');
      expect(sse).toContain('Hello');
    });

    it('should format done chunks', () => {
      const chunk = createStreamChunk('done', null);
      const sse = formatSSE(chunk);
      expect(sse).toContain('event: done');
    });

    it('should format error chunks', () => {
      const chunk = createStreamChunk('error', 'Something went wrong');
      const sse = formatSSE(chunk);
      expect(sse).toContain('event: error');
      expect(sse).toContain('Something went wrong');
    });

    it('should include metadata when provided', () => {
      const chunk = createStreamChunk('token', 'test', { model: 'gpt-4' });
      const sse = formatSSE(chunk);
      expect(sse).toContain('gpt-4');
    });

    it('should format chunks without metadata', () => {
      const chunk = createStreamChunk('token', 'test');
      const sse = formatSSE(chunk);
      expect(sse).toBeDefined();
      expect(sse).toContain('event: token');
    });
  });

  describe('createStreamChunk', () => {
    it('should create chunk with all fields', () => {
      const chunk = createStreamChunk('token', 'data', { key: 'value' });
      expect(chunk.type).toBe('token');
      expect(chunk.data).toBe('data');
      expect(chunk.timestamp).toBeDefined();
      expect(chunk.metadata).toEqual({ key: 'value' });
    });

    it('should create chunk without metadata', () => {
      const chunk = createStreamChunk('done', null);
      expect(chunk.type).toBe('done');
      expect(chunk.metadata).toBeUndefined();
    });
  });

  describe('StreamCollector', () => {
    it('should accumulate token chunks into content', () => {
      const collector = new StreamCollector();
      collector.add(createStreamChunk('token', 'Hello '));
      collector.add(createStreamChunk('token', 'World'));
      expect(collector.getContent()).toBe('Hello World');
    });

    it('should track done state', () => {
      const collector = new StreamCollector();
      expect(collector.done).toBe(false);
      collector.add(createStreamChunk('done', null));
      expect(collector.done).toBe(true);
    });

    it('should capture errors', () => {
      const collector = new StreamCollector();
      expect(collector.error).toBeNull();
      collector.add(createStreamChunk('error', 'Failed'));
      expect(collector.error).toBeInstanceOf(Error);
      expect(collector.error?.message).toBe('Failed');
    });

    it('should track chunk count', () => {
      const collector = new StreamCollector();
      expect(collector.count).toBe(0);
      collector.add(createStreamChunk('token', 'a'));
      collector.add(createStreamChunk('token', 'b'));
      expect(collector.count).toBe(2);
    });

    it('should return all chunks', () => {
      const collector = new StreamCollector();
      const chunk1 = createStreamChunk('token', 'a');
      const chunk2 = createStreamChunk('token', 'b');
      collector.add(chunk1);
      collector.add(chunk2);
      const chunks = collector.getChunks();
      expect(chunks.length).toBe(2);
      expect(chunks[0].data).toBe('a');
      expect(chunks[1].data).toBe('b');
    });

    it('should reset state', () => {
      const collector = new StreamCollector();
      collector.add(createStreamChunk('token', 'test'));
      collector.add(createStreamChunk('done', null));
      
      collector.reset();
      
      expect(collector.count).toBe(0);
      expect(collector.getContent()).toBe('');
      expect(collector.done).toBe(false);
      expect(collector.error).toBeNull();
    });

    it('should handle non-string token data', () => {
      const collector = new StreamCollector();
      collector.add(createStreamChunk('token', { object: 'data' }));
      expect(collector.getContent()).toBe('');
    });

    it('should handle non-token, non-done, non-error chunks', () => {
      const collector = new StreamCollector();
      collector.add({ type: 'usage' as any, data: { tokens: 100 }, timestamp: Date.now() });
      expect(collector.count).toBe(1);
      expect(collector.done).toBe(false);
      expect(collector.error).toBeNull();
    });
  });
});
