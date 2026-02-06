/**
 * Sliding Window Memory - Keeps only the most recent N messages
 *
 * Maintains a configurable window of recent messages, discarding older ones.
 * System messages are always retained. Efficient for long-running conversations
 * where only recent context matters.
 */

import type { Message } from '../types/index.js';
import { estimateMessagesTokens, estimateTokens } from '../chat/message.js';
import type { MemoryManager, MemoryStats } from './memory-manager.js';

export interface SlidingWindowOptions {
  /** Maximum number of messages to keep */
  windowSize: number;
  /** Maximum tokens in the context window */
  maxTokens: number;
  /** Whether to always keep system messages */
  keepSystemMessages?: boolean;
}

export class SlidingWindowMemory implements MemoryManager {
  readonly name = 'sliding-window';
  private store: Map<string, Message[]> = new Map();
  private options: Required<SlidingWindowOptions>;

  constructor(options: SlidingWindowOptions) {
    this.options = {
      keepSystemMessages: true,
      ...options,
    };
  }

  async save(conversationId: string, messages: Message[]): Promise<void> {
    const existing = this.store.get(conversationId) ?? [];
    const all = [...existing, ...messages];
    this.store.set(conversationId, this.applyWindow(all));
  }

  async load(conversationId: string): Promise<Message[]> {
    return this.store.get(conversationId) ?? [];
  }

  async getContext(conversationId: string, maxTokens: number): Promise<Message[]> {
    const messages = this.store.get(conversationId) ?? [];
    return this.truncateToTokens(messages, maxTokens);
  }

  async search(conversationId: string, query: string, limit?: number): Promise<Message[]> {
    const messages = this.store.get(conversationId) ?? [];
    const queryLower = query.toLowerCase();
    const matches = messages.filter((m) =>
      m.content.toLowerCase().includes(queryLower)
    );
    return limit ? matches.slice(0, limit) : matches;
  }

  async clear(conversationId: string): Promise<void> {
    this.store.delete(conversationId);
  }

  async clearAll(): Promise<void> {
    this.store.clear();
  }

  async getStats(conversationId: string): Promise<MemoryStats> {
    const messages = this.store.get(conversationId) ?? [];
    return {
      conversationId,
      messageCount: messages.length,
      estimatedTokens: estimateMessagesTokens(messages),
      oldestMessageTimestamp: messages[0]?.metadata.timestamp,
      newestMessageTimestamp: messages[messages.length - 1]?.metadata.timestamp,
    };
  }

  /**
   * Apply sliding window to messages
   */
  private applyWindow(messages: Message[]): Message[] {
    const systemMessages = this.options.keepSystemMessages
      ? messages.filter((m) => m.role === 'system')
      : [];
    const nonSystemMessages = this.options.keepSystemMessages
      ? messages.filter((m) => m.role !== 'system')
      : messages;

    // Keep only the most recent windowSize messages
    const windowed = nonSystemMessages.slice(-this.options.windowSize);

    return [...systemMessages, ...windowed];
  }

  /**
   * Truncate messages to fit within a token budget
   */
  private truncateToTokens(messages: Message[], maxTokens: number): Message[] {
    const systemMessages = this.options.keepSystemMessages
      ? messages.filter((m) => m.role === 'system')
      : [];
    const nonSystemMessages = this.options.keepSystemMessages
      ? messages.filter((m) => m.role !== 'system')
      : messages;

    const systemTokens = estimateMessagesTokens(systemMessages);
    const remainingBudget = maxTokens - systemTokens;

    if (remainingBudget <= 0) {
      return systemMessages;
    }

    const result: Message[] = [];
    let currentTokens = 0;

    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const msgTokens = estimateTokens(nonSystemMessages[i].content) + 4;
      if (currentTokens + msgTokens > remainingBudget) {
        break;
      }
      result.unshift(nonSystemMessages[i]);
      currentTokens += msgTokens;
    }

    return [...systemMessages, ...result];
  }
}
