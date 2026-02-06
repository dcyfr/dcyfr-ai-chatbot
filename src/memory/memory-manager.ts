/**
 * Memory Manager - Abstract interface for conversation memory
 *
 * Memory strategies control how conversation context is stored, retrieved,
 * and managed over time. Different strategies offer trade-offs between
 * context completeness and token efficiency.
 */

import type { Message } from '../types/index.js';

/**
 * Abstract memory manager interface
 */
export interface MemoryManager {
  /** Strategy name */
  readonly name: string;

  /** Save messages to memory */
  save(conversationId: string, messages: Message[]): Promise<void>;

  /** Load messages from memory */
  load(conversationId: string): Promise<Message[]>;

  /** Get context-optimized messages for the provider */
  getContext(conversationId: string, maxTokens: number): Promise<Message[]>;

  /** Search memory for relevant messages */
  search(conversationId: string, query: string, limit?: number): Promise<Message[]>;

  /** Clear memory for a conversation */
  clear(conversationId: string): Promise<void>;

  /** Clear all memory */
  clearAll(): Promise<void>;

  /** Get memory statistics */
  getStats(conversationId: string): Promise<MemoryStats>;
}

/** Memory usage statistics */
export interface MemoryStats {
  conversationId: string;
  messageCount: number;
  estimatedTokens: number;
  oldestMessageTimestamp?: number;
  newestMessageTimestamp?: number;
}
