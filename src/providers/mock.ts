/**
 * Mock Provider - Deterministic LLM provider for testing
 *
 * Returns configurable responses, making it perfect for unit tests,
 * integration tests, and development without API keys.
 */

import type {
  ChatProvider,
  Message,
  ProviderRequest,
  ProviderResponse,
  StreamChunk,
  ToolCall,
} from '../types/index.js';
import { createMessage } from '../chat/message.js';
import { createStreamChunk } from '../streaming/stream-handler.js';

export interface MockProviderOptions {
  /** Default response content */
  defaultResponse?: string;
  /** Map of trigger words to responses */
  responses?: Map<string, string>;
  /** Simulated latency in ms */
  latencyMs?: number;
  /** Simulated token usage */
  tokensPerResponse?: number;
  /** Whether to simulate errors */
  simulateErrors?: boolean;
  /** Error rate (0-1) when simulateErrors is true */
  errorRate?: number;
  /** Simulated tool calls */
  toolCalls?: ToolCall[];
  /** Streaming chunk delay in ms */
  streamDelayMs?: number;
}

export class MockProvider implements ChatProvider {
  readonly name = 'mock';
  private options: Required<MockProviderOptions>;
  private callCount = 0;

  constructor(options?: MockProviderOptions) {
    this.options = {
      defaultResponse: 'This is a mock response.',
      responses: new Map(),
      latencyMs: 0,
      tokensPerResponse: 10,
      simulateErrors: false,
      errorRate: 0.1,
      toolCalls: [],
      streamDelayMs: 0,
      ...options,
    };
  }

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    this.callCount++;

    if (this.options.simulateErrors && Math.random() < this.options.errorRate) {
      throw new Error('Mock provider simulated error');
    }

    if (this.options.latencyMs > 0) {
      await delay(this.options.latencyMs);
    }

    const responseContent = this.getResponse(request.messages);

    const message = createMessage('assistant', responseContent, {
      model: request.model,
      tokens: this.options.tokensPerResponse,
    });

    return {
      message,
      usage: {
        promptTokens: Math.ceil(
          request.messages.reduce((sum, m) => sum + m.content.length / 4, 0)
        ),
        completionTokens: this.options.tokensPerResponse,
        totalTokens:
          Math.ceil(request.messages.reduce((sum, m) => sum + m.content.length / 4, 0)) +
          this.options.tokensPerResponse,
      },
      toolCalls: this.options.toolCalls.length > 0 ? this.options.toolCalls : undefined,
      finishReason: this.options.toolCalls.length > 0 ? 'tool_calls' : 'stop',
    };
  }

  async *stream(request: ProviderRequest): AsyncIterable<StreamChunk> {
    this.callCount++;

    if (this.options.simulateErrors && Math.random() < this.options.errorRate) {
      yield createStreamChunk('error', 'Mock provider simulated error');
      return;
    }

    const responseContent = this.getResponse(request.messages);
    const words = responseContent.split(' ');

    for (let i = 0; i < words.length; i++) {
      const token = i === 0 ? words[i] : ` ${words[i]}`;

      if (this.options.streamDelayMs > 0) {
        await delay(this.options.streamDelayMs);
      }

      yield createStreamChunk('token', token);
    }

    yield createStreamChunk('done', null, {
      model: request.model,
      usage: {
        promptTokens: Math.ceil(
          request.messages.reduce((sum, m) => sum + m.content.length / 4, 0)
        ),
        completionTokens: this.options.tokensPerResponse,
        totalTokens:
          Math.ceil(request.messages.reduce((sum, m) => sum + m.content.length / 4, 0)) +
          this.options.tokensPerResponse,
      },
    });
  }

  /**
   * Get the number of times complete/stream was called
   */
  getCallCount(): number {
    return this.callCount;
  }

  /**
   * Reset call count
   */
  resetCallCount(): void {
    this.callCount = 0;
  }

  /**
   * Set a custom response for a trigger word
   */
  setResponse(trigger: string, response: string): void {
    this.options.responses.set(trigger.toLowerCase(), response);
  }

  /**
   * Set the default response
   */
  setDefaultResponse(response: string): void {
    this.options.defaultResponse = response;
  }

  private getResponse(messages: Message[]): string {
    // Check for trigger words in the last user message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      const content = lastUserMessage.content.toLowerCase();
      for (const [trigger, response] of this.options.responses) {
        if (content.includes(trigger)) {
          return response;
        }
      }
    }

    return this.options.defaultResponse;
  }
}

/**
 * Delay utility for simulating latency
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
