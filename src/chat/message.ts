/**
 * Message handling utilities
 *
 * Create, validate, and format chat messages.
 */

import { randomUUID } from 'node:crypto';
import type { Message, MessageRole } from '../types/index.js';

/**
 * Create a new chat message
 */
export function createMessage(
  role: MessageRole,
  content: string,
  options?: {
    id?: string;
    name?: string;
    model?: string;
    toolCallId?: string;
    toolName?: string;
    tokens?: number;
    latencyMs?: number;
    finishReason?: Message['metadata']['finishReason'];
  }
): Message {
  return {
    id: options?.id ?? randomUUID(),
    role,
    content,
    name: options?.name,
    metadata: {
      timestamp: Date.now(),
      model: options?.model,
      tokens: options?.tokens,
      latencyMs: options?.latencyMs,
      toolCallId: options?.toolCallId,
      toolName: options?.toolName,
      finishReason: options?.finishReason,
    },
  };
}

/**
 * Estimate token count for a string (rough approximation: ~4 chars per token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimate total tokens for a list of messages
 */
export function estimateMessagesTokens(messages: Message[]): number {
  let total = 0;
  for (const msg of messages) {
    // Role + content + overhead per message (~4 tokens)
    total += estimateTokens(msg.content) + 4;
    if (msg.name) {
      total += estimateTokens(msg.name) + 1;
    }
  }
  return total;
}

/**
 * Format messages for display (useful for debugging)
 */
export function formatMessages(messages: Message[]): string {
  return messages
    .map((msg) => {
      const prefix = msg.role.toUpperCase();
      const name = msg.name ? ` (${msg.name})` : '';
      return `[${prefix}${name}]: ${msg.content}`;
    })
    .join('\n');
}

/**
 * Validate message content is not empty or whitespace-only
 */
export function validateMessageContent(content: string): {
  valid: boolean;
  error?: string;
} {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: 'Message content cannot be empty' };
  }
  if (content.length > 100_000) {
    return { valid: false, error: 'Message content exceeds maximum length (100,000 characters)' };
  }
  return { valid: true };
}

/**
 * Truncate messages to fit within a token budget
 */
export function truncateMessages(
  messages: Message[],
  maxTokens: number,
  options?: { keepSystemMessages?: boolean }
): Message[] {
  const keepSystem = options?.keepSystemMessages ?? true;
  const systemMessages = keepSystem ? messages.filter((m) => m.role === 'system') : [];
  const nonSystemMessages = keepSystem
    ? messages.filter((m) => m.role !== 'system')
    : [...messages];

  const systemTokens = estimateMessagesTokens(systemMessages);
  const remainingBudget = maxTokens - systemTokens;

  if (remainingBudget <= 0) {
    return systemMessages;
  }

  // Start from the most recent messages and work backwards
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
