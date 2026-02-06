/**
 * Summary Memory - Summarizes older messages to save tokens
 *
 * Keeps recent messages in full and summarizes older messages into a
 * condensed summary. This allows for very long conversations while
 * keeping the context window manageable.
 */

import type { Message } from '../types/index.js';
import { createMessage, estimateMessagesTokens, estimateTokens } from '../chat/message.js';
import type { MemoryManager, MemoryStats } from './memory-manager.js';

export interface SummaryMemoryOptions {
  /** Number of recent messages to keep in full */
  recentCount: number;
  /** Maximum tokens for the summary */
  maxSummaryTokens: number;
  /** Custom summarization function (if not provided, uses simple truncation) */
  summarizer?: (messages: Message[]) => Promise<string>;
}

export class SummaryMemory implements MemoryManager {
  readonly name = 'summary';
  private store: Map<string, Message[]> = new Map();
  private summaries: Map<string, string> = new Map();
  private options: Required<SummaryMemoryOptions>;

  constructor(options: SummaryMemoryOptions) {
    this.options = {
      summarizer: defaultSummarizer,
      ...options,
    };
  }

  async save(conversationId: string, messages: Message[]): Promise<void> {
    const existing = this.store.get(conversationId) ?? [];
    const all = [...existing, ...messages];

    // If we have more messages than recentCount, summarize older ones
    if (all.length > this.options.recentCount) {
      const toSummarize = all.slice(0, all.length - this.options.recentCount);
      const recent = all.slice(-this.options.recentCount);

      const existingSummary = this.summaries.get(conversationId) ?? '';
      const newContent = toSummarize.map((m) => `${m.role}: ${m.content}`).join('\n');
      const combinedContent = existingSummary
        ? `${existingSummary}\n${newContent}`
        : newContent;

      const summary = await this.options.summarizer(
        [createMessage('system', combinedContent)]
      );
      this.summaries.set(conversationId, summary);
      this.store.set(conversationId, recent);
    } else {
      this.store.set(conversationId, all);
    }
  }

  async load(conversationId: string): Promise<Message[]> {
    const messages = this.store.get(conversationId) ?? [];
    const summary = this.summaries.get(conversationId);

    if (summary) {
      const summaryMessage = createMessage(
        'system',
        `Previous conversation summary:\n${summary}`
      );
      return [summaryMessage, ...messages];
    }

    return messages;
  }

  async getContext(conversationId: string, maxTokens: number): Promise<Message[]> {
    const messages = await this.load(conversationId);

    // Truncate if still too long
    let total = estimateMessagesTokens(messages);
    const result = [...messages];

    while (total > maxTokens && result.length > 1) {
      // Remove the oldest non-summary message
      const idx = result.findIndex((m) => !m.content.startsWith('Previous conversation summary:'));
      if (idx === -1) break;
      total -= estimateTokens(result[idx].content) + 4;
      result.splice(idx, 1);
    }

    return result;
  }

  async search(conversationId: string, query: string, limit?: number): Promise<Message[]> {
    const messages = this.store.get(conversationId) ?? [];
    const queryLower = query.toLowerCase();
    const matches = messages.filter((m) =>
      m.content.toLowerCase().includes(queryLower)
    );

    // Also search in summary
    const summary = this.summaries.get(conversationId);
    if (summary && summary.toLowerCase().includes(queryLower)) {
      matches.unshift(createMessage('system', `[From summary]: ${summary}`));
    }

    return limit ? matches.slice(0, limit) : matches;
  }

  async clear(conversationId: string): Promise<void> {
    this.store.delete(conversationId);
    this.summaries.delete(conversationId);
  }

  async clearAll(): Promise<void> {
    this.store.clear();
    this.summaries.clear();
  }

  async getStats(conversationId: string): Promise<MemoryStats> {
    const messages = this.store.get(conversationId) ?? [];
    const summary = this.summaries.get(conversationId);
    const summaryTokens = summary ? estimateTokens(summary) : 0;
    return {
      conversationId,
      messageCount: messages.length,
      estimatedTokens: estimateMessagesTokens(messages) + summaryTokens,
      oldestMessageTimestamp: messages[0]?.metadata.timestamp,
      newestMessageTimestamp: messages[messages.length - 1]?.metadata.timestamp,
    };
  }

  /**
   * Get the current summary for a conversation
   */
  getSummary(conversationId: string): string | undefined {
    return this.summaries.get(conversationId);
  }
}

/**
 * Default summarizer - concatenates and truncates messages
 */
async function defaultSummarizer(messages: Message[]): Promise<string> {
  const content = messages.map((m) => m.content).join('\n');
  // Simple truncation to ~500 chars
  if (content.length > 500) {
    return content.slice(0, 497) + '...';
  }
  return content;
}
