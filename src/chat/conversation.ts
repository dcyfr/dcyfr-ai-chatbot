/**
 * Conversation management
 *
 * Create, retrieve, update, and manage conversation threads.
 */

import { randomUUID } from 'node:crypto';
import type { Conversation, ConversationMetadata, Message } from '../types/index.js';
import { estimateTokens } from './message.js';

/**
 * Manages conversation lifecycle and persistence
 */
export class ConversationManager {
  private conversations: Map<string, Conversation> = new Map();

  /**
   * Create a new conversation
   */
  create(options?: {
    id?: string;
    title?: string;
    systemPrompt?: string;
    tags?: string[];
    model?: string;
  }): Conversation {
    const now = Date.now();
    const conversation: Conversation = {
      id: options?.id ?? randomUUID(),
      messages: [],
      metadata: {
        title: options?.title,
        tags: options?.tags ?? [],
        systemPrompt: options?.systemPrompt,
        model: options?.model,
        totalTokens: 0,
        messageCount: 0,
      },
      createdAt: now,
      updatedAt: now,
    };

    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  /**
   * Get a conversation by ID
   */
  get(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }

  /**
   * Get or create a conversation
   */
  getOrCreate(id: string, options?: { systemPrompt?: string; model?: string }): Conversation {
    const existing = this.conversations.get(id);
    if (existing) {
      return existing;
    }
    return this.create({ id, ...options });
  }

  /**
   * List all conversations
   */
  list(options?: {
    limit?: number;
    offset?: number;
    tags?: string[];
    sortBy?: 'createdAt' | 'updatedAt';
    order?: 'asc' | 'desc';
  }): Conversation[] {
    let conversations = Array.from(this.conversations.values());

    // Filter by tags
    if (options?.tags && options.tags.length > 0) {
      conversations = conversations.filter((c) =>
        options.tags!.some((tag) => c.metadata.tags?.includes(tag))
      );
    }

    // Sort
    const sortBy = options?.sortBy ?? 'updatedAt';
    const order = options?.order ?? 'desc';
    conversations.sort((a, b) => {
      const diff = a[sortBy] - b[sortBy];
      return order === 'desc' ? -diff : diff;
    });

    // Paginate
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 50;
    return conversations.slice(offset, offset + limit);
  }

  /**
   * Add a message to a conversation
   */
  addMessage(conversationId: string, message: Message): Conversation {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    conversation.messages.push(message);
    conversation.metadata.messageCount = conversation.messages.length;
    conversation.metadata.totalTokens += estimateTokens(message.content);
    conversation.updatedAt = Date.now();

    return conversation;
  }

  /**
   * Get messages from a conversation
   */
  getMessages(
    conversationId: string,
    options?: { limit?: number; offset?: number; roles?: Message['role'][] }
  ): Message[] {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return [];
    }

    let messages = [...conversation.messages];

    if (options?.roles && options.roles.length > 0) {
      messages = messages.filter((m) => options.roles!.includes(m.role));
    }

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? messages.length;
    return messages.slice(offset, offset + limit);
  }

  /**
   * Update conversation metadata
   */
  updateMetadata(
    conversationId: string,
    updates: Partial<ConversationMetadata>
  ): Conversation {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    conversation.metadata = { ...conversation.metadata, ...updates };
    conversation.updatedAt = Date.now();
    return conversation;
  }

  /**
   * Delete a conversation
   */
  delete(conversationId: string): boolean {
    return this.conversations.delete(conversationId);
  }

  /**
   * Clear all conversations
   */
  clear(): void {
    this.conversations.clear();
  }

  /**
   * Get conversation count
   */
  get size(): number {
    return this.conversations.size;
  }

  /**
   * Export a conversation as JSON
   */
  export(conversationId: string): string | undefined {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return undefined;
    }
    return JSON.stringify(conversation, null, 2);
  }

  /**
   * Import a conversation from JSON
   */
  import(json: string): Conversation {
    const conversation = JSON.parse(json) as Conversation;
    this.conversations.set(conversation.id, conversation);
    return conversation;
  }
}
