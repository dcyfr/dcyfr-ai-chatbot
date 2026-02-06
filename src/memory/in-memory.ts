/**
 * In-Memory Storage - Simple Map-based memory
 *
 * Stores all messages in memory with no eviction policy.
 * Suitable for short-lived conversations or testing.
 */

import type { Message } from '../types/index.js';
import { estimateMessagesTokens } from '../chat/message.js';
import type { MemoryManager, MemoryStats } from './memory-manager.js';

export class InMemoryStorage implements MemoryManager {
  readonly name = 'in-memory';
  private store: Map<string, Message[]> = new Map();

  async save(conversationId: string, messages: Message[]): Promise<void> {
    const existing = this.store.get(conversationId) ?? [];
    this.store.set(conversationId, [...existing, ...messages]);
  }

  async load(conversationId: string): Promise<Message[]> {
    return this.store.get(conversationId) ?? [];
  }

  async getContext(conversationId: string, _maxTokens: number): Promise<Message[]> {
    return this.store.get(conversationId) ?? [];
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
}
