/**
 * Stream Handler - Server-Sent Events (SSE) format streaming
 *
 * Handles the server-side of streaming chat responses, formatting
 * chunks as SSE events and managing stream lifecycle.
 */

import type { StreamChunk } from '../types/index.js';

/**
 * Format a stream chunk as an SSE event string
 */
export function formatSSE(chunk: StreamChunk): string {
  const event = chunk.type;
  const data = JSON.stringify({
    type: chunk.type,
    data: chunk.data,
    timestamp: chunk.timestamp,
    metadata: chunk.metadata,
  });
  return `event: ${event}\ndata: ${data}\n\n`;
}

/**
 * Create a stream chunk
 */
export function createStreamChunk(
  type: StreamChunk['type'],
  data: unknown,
  metadata?: Record<string, unknown>
): StreamChunk {
  return {
    type,
    data,
    timestamp: Date.now(),
    metadata,
  };
}

/**
 * Stream collector - accumulates chunks into a full response
 */
export class StreamCollector {
  private chunks: StreamChunk[] = [];
  private content = '';
  private _done = false;
  private _error: Error | null = null;

  /**
   * Add a chunk to the collector
   */
  add(chunk: StreamChunk): void {
    this.chunks.push(chunk);

    if (chunk.type === 'token' && typeof chunk.data === 'string') {
      this.content += chunk.data;
    } else if (chunk.type === 'done') {
      this._done = true;
    } else if (chunk.type === 'error') {
      this._error = new Error(String(chunk.data));
    }
  }

  /**
   * Get the accumulated content
   */
  getContent(): string {
    return this.content;
  }

  /**
   * Get all collected chunks
   */
  getChunks(): StreamChunk[] {
    return [...this.chunks];
  }

  /**
   * Check if the stream is complete
   */
  get done(): boolean {
    return this._done;
  }

  /**
   * Get any error that occurred
   */
  get error(): Error | null {
    return this._error;
  }

  /**
   * Get chunk count
   */
  get count(): number {
    return this.chunks.length;
  }

  /**
   * Reset the collector
   */
  reset(): void {
    this.chunks = [];
    this.content = '';
    this._done = false;
    this._error = null;
  }
}

/**
 * Stream handler with backpressure and lifecycle management
 */
export class StreamHandler {
  private abortController: AbortController;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private onChunkCallbacks: Array<(chunk: StreamChunk) => void> = [];
  private onDoneCallbacks: Array<() => void> = [];
  private onErrorCallbacks: Array<(error: Error) => void> = [];

  constructor(private heartbeatIntervalMs = 15000) {
    this.abortController = new AbortController();
  }

  /**
   * Start receiving stream chunks
   */
  async *handle(source: AsyncIterable<StreamChunk>): AsyncIterable<StreamChunk> {
    this.startHeartbeat();

    try {
      for await (const chunk of source) {
        if (this.abortController.signal.aborted) {
          break;
        }

        for (const callback of this.onChunkCallbacks) {
          callback(chunk);
        }

        yield chunk;

        if (chunk.type === 'done') {
          for (const callback of this.onDoneCallbacks) {
            callback();
          }
          break;
        }

        if (chunk.type === 'error') {
          const error = new Error(String(chunk.data));
          for (const callback of this.onErrorCallbacks) {
            callback(error);
          }
          break;
        }
      }
    } finally {
      this.stopHeartbeat();
    }
  }

  /**
   * Register a callback for each chunk
   */
  onChunk(callback: (chunk: StreamChunk) => void): this {
    this.onChunkCallbacks.push(callback);
    return this;
  }

  /**
   * Register a callback for stream completion
   */
  onDone(callback: () => void): this {
    this.onDoneCallbacks.push(callback);
    return this;
  }

  /**
   * Register a callback for errors
   */
  onError(callback: (error: Error) => void): this {
    this.onErrorCallbacks.push(callback);
    return this;
  }

  /**
   * Abort the stream
   */
  abort(): void {
    this.abortController.abort();
    this.stopHeartbeat();
  }

  /**
   * Check if the stream was aborted
   */
  get aborted(): boolean {
    return this.abortController.signal.aborted;
  }

  private startHeartbeat(): void {
    if (this.heartbeatIntervalMs > 0) {
      this.heartbeatInterval = setInterval(() => {
        // Heartbeat would be sent via SSE in a real server context
      }, this.heartbeatIntervalMs);
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}
