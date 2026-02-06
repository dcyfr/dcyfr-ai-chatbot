/**
 * Token Streamer - Token-by-token output with buffering
 *
 * Provides character/token-level streaming with configurable
 * buffering and flush intervals for smooth output.
 */

import type { StreamChunk } from '../types/index.js';
import { createStreamChunk } from './stream-handler.js';

export interface TokenStreamerOptions {
  /** Minimum chars to buffer before emitting */
  bufferSize?: number;
  /** Maximum time (ms) before flushing buffer */
  flushIntervalMs?: number;
  /** Word boundary detection for natural breaks */
  wordBoundary?: boolean;
}

/**
 * Buffers and emits tokens at configured intervals
 */
export class TokenStreamer {
  private buffer = '';
  private options: Required<TokenStreamerOptions>;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private emitCallback: ((chunk: StreamChunk) => void) | null = null;

  constructor(options?: TokenStreamerOptions) {
    this.options = {
      bufferSize: 1,
      flushIntervalMs: 50,
      wordBoundary: false,
      ...options,
    };
  }

  /**
   * Set the emit callback
   */
  onEmit(callback: (chunk: StreamChunk) => void): this {
    this.emitCallback = callback;
    return this;
  }

  /**
   * Add text to the buffer
   */
  write(text: string): StreamChunk[] {
    this.buffer += text;
    return this.maybeFlush();
  }

  /**
   * Flush any remaining buffer content
   */
  flush(): StreamChunk[] {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.buffer.length === 0) {
      return [];
    }

    const content = this.buffer;
    this.buffer = '';

    const chunk = createStreamChunk('token', content);
    if (this.emitCallback) {
      this.emitCallback(chunk);
    }
    return [chunk];
  }

  /**
   * Create a done chunk
   */
  done(metadata?: Record<string, unknown>): StreamChunk {
    // Flush remaining content
    this.flush();
    return createStreamChunk('done', null, metadata);
  }

  /**
   * Create an error chunk
   */
  error(message: string): StreamChunk {
    this.buffer = '';
    return createStreamChunk('error', message);
  }

  /**
   * Get current buffer content
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * Reset the streamer
   */
  reset(): void {
    this.buffer = '';
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private maybeFlush(): StreamChunk[] {
    if (this.buffer.length < this.options.bufferSize) {
      this.scheduleFlush();
      return [];
    }

    if (this.options.wordBoundary) {
      // Find the last word boundary
      const lastSpace = this.buffer.lastIndexOf(' ');
      if (lastSpace > 0) {
        const content = this.buffer.slice(0, lastSpace + 1);
        this.buffer = this.buffer.slice(lastSpace + 1);
        const chunk = createStreamChunk('token', content);
        if (this.emitCallback) {
          this.emitCallback(chunk);
        }
        return [chunk];
      }
    }

    return this.flush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, this.options.flushIntervalMs);
  }
}

/**
 * Transform an async iterable of stream chunks
 *
 * Applies a transformation function to each chunk in the stream.
 */
export async function* transformStream(
  source: AsyncIterable<StreamChunk>,
  transform: (chunk: StreamChunk) => StreamChunk | null
): AsyncIterable<StreamChunk> {
  for await (const chunk of source) {
    const transformed = transform(chunk);
    if (transformed !== null) {
      yield transformed;
    }
  }
}

/**
 * Filter stream chunks by type
 */
export async function* filterStream(
  source: AsyncIterable<StreamChunk>,
  types: StreamChunk['type'][]
): AsyncIterable<StreamChunk> {
  for await (const chunk of source) {
    if (types.includes(chunk.type)) {
      yield chunk;
    }
  }
}

/**
 * Collect all chunks from a stream into an array
 */
export async function collectStream(
  source: AsyncIterable<StreamChunk>
): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];
  for await (const chunk of source) {
    chunks.push(chunk);
  }
  return chunks;
}
