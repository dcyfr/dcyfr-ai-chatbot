/**
 * Core types for the DCYFR chatbot framework
 *
 * Provides Zod schemas and TypeScript types for messages, conversations,
 * chat configuration, providers, middleware, and plugins.
 */

import { z } from 'zod';

// ============================================================================
// Message Types
// ============================================================================

/** Supported message roles */
export const MessageRoleSchema = z.enum([
  'system',
  'user',
  'assistant',
  'tool',
]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

/** Token usage statistics */
export const TokenUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});
export type TokenUsage = z.infer<typeof TokenUsageSchema>;

/** Message metadata */
export const MessageMetadataSchema = z.object({
  timestamp: z.number(),
  tokens: z.number().int().nonnegative().optional(),
  model: z.string().optional(),
  latencyMs: z.number().nonnegative().optional(),
  toolCallId: z.string().optional(),
  toolName: z.string().optional(),
  finishReason: z
    .enum(['stop', 'length', 'tool_calls', 'content_filter', 'error'])
    .optional(),
});
export type MessageMetadata = z.infer<typeof MessageMetadataSchema>;

/** A single chat message */
export const MessageSchema = z.object({
  id: z.string(),
  role: MessageRoleSchema,
  content: z.string(),
  name: z.string().optional(),
  metadata: MessageMetadataSchema,
});
export type Message = z.infer<typeof MessageSchema>;

/** Tool call within a message */
export const ToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.record(z.unknown()),
});
export type ToolCall = z.infer<typeof ToolCallSchema>;

/** Tool definition for function calling */
export const ToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.unknown()),
  execute: z.function().args(z.record(z.unknown())).returns(z.promise(z.unknown())).optional(),
});
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

// ============================================================================
// Conversation Types
// ============================================================================

/** Conversation metadata */
export const ConversationMetadataSchema = z.object({
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
  systemPrompt: z.string().optional(),
  model: z.string().optional(),
  totalTokens: z.number().int().nonnegative().default(0),
  messageCount: z.number().int().nonnegative().default(0),
});
export type ConversationMetadata = z.infer<typeof ConversationMetadataSchema>;

/** A conversation (thread of messages) */
export const ConversationSchema = z.object({
  id: z.string(),
  messages: z.array(MessageSchema),
  metadata: ConversationMetadataSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

// ============================================================================
// Chat Configuration
// ============================================================================

/** Memory strategy configuration */
export const MemoryConfigSchema = z.object({
  type: z.enum(['in-memory', 'sliding-window', 'summary']).default('sliding-window'),
  windowSize: z.number().int().positive().default(20),
  maxTokens: z.number().int().positive().default(8192),
  summaryPrompt: z.string().optional(),
});
export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;

/** Streaming configuration */
export const StreamConfigSchema = z.object({
  enabled: z.boolean().default(true),
  chunkSize: z.number().int().positive().default(1),
  flushIntervalMs: z.number().int().nonnegative().default(50),
  heartbeatIntervalMs: z.number().int().nonnegative().default(15000),
});
export type StreamConfig = z.infer<typeof StreamConfigSchema>;

/** Rate limiting configuration */
export const RateLimitConfigSchema = z.object({
  maxRequests: z.number().int().positive().default(60),
  windowMs: z.number().int().positive().default(60000),
  maxTokensPerMinute: z.number().int().positive().optional(),
  strategy: z.enum(['fixed-window', 'sliding-window', 'token-bucket']).default('token-bucket'),
});
export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

/** Main chat engine configuration */
export const ChatConfigSchema = z.object({
  model: z.string().default('gpt-4o'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().positive().default(4096),
  systemPrompt: z.string().default('You are a helpful AI assistant.'),
  memory: MemoryConfigSchema.default({}),
  streaming: StreamConfigSchema.default({}),
  rateLimit: RateLimitConfigSchema.optional(),
  tools: z.array(ToolDefinitionSchema).default([]),
  plugins: z.array(z.string()).default([]),
  verbose: z.boolean().default(false),
});
export type ChatConfig = z.infer<typeof ChatConfigSchema>;

// ============================================================================
// Request/Response Types
// ============================================================================

/** Chat request */
export const ChatRequestSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1),
  role: MessageRoleSchema.default('user'),
  stream: z.boolean().default(false),
  options: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().positive().optional(),
      model: z.string().optional(),
      tools: z.array(ToolDefinitionSchema).optional(),
    })
    .optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/** Chat response */
export const ChatResponseSchema = z.object({
  message: MessageSchema,
  conversationId: z.string(),
  usage: TokenUsageSchema.optional(),
  toolCalls: z.array(ToolCallSchema).optional(),
  finishReason: z
    .enum(['stop', 'length', 'tool_calls', 'content_filter', 'error'])
    .default('stop'),
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// ============================================================================
// Stream Types
// ============================================================================

/** Stream chunk types */
export const StreamChunkTypeSchema = z.enum([
  'token',
  'tool_call',
  'tool_result',
  'metadata',
  'error',
  'done',
]);
export type StreamChunkType = z.infer<typeof StreamChunkTypeSchema>;

/** A single stream chunk */
export const StreamChunkSchema = z.object({
  type: StreamChunkTypeSchema,
  data: z.unknown(),
  timestamp: z.number(),
  metadata: z.record(z.unknown()).optional(),
});
export type StreamChunk = z.infer<typeof StreamChunkSchema>;

// ============================================================================
// Provider Types
// ============================================================================

/** Provider configuration */
export const ProviderConfigSchema = z.object({
  type: z.enum(['openai', 'anthropic', 'mock', 'custom']).default('openai'),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().default('gpt-4o'),
  maxRetries: z.number().int().nonnegative().default(3),
  timeoutMs: z.number().int().positive().default(30000),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

/** Provider completion request */
export interface ProviderRequest {
  messages: Message[];
  model: string;
  temperature: number;
  maxTokens: number;
  tools?: ToolDefinition[];
  stream?: boolean;
}

/** Provider completion response */
export interface ProviderResponse {
  message: Message;
  usage: TokenUsage;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error';
}

/** Chat provider interface */
export interface ChatProvider {
  readonly name: string;
  complete(request: ProviderRequest): Promise<ProviderResponse>;
  stream(request: ProviderRequest): AsyncIterable<StreamChunk>;
}

// ============================================================================
// Middleware Types
// ============================================================================

/** Middleware context */
export interface MiddlewareContext {
  request: ChatRequest;
  conversation: Conversation;
  config: ChatConfig;
  metadata: Record<string, unknown>;
}

/** Middleware result */
export interface MiddlewareResult {
  proceed: boolean;
  context: MiddlewareContext;
  error?: string;
}

/** Middleware function signature */
export type MiddlewareFn = (
  context: MiddlewareContext,
  next: () => Promise<MiddlewareResult>
) => Promise<MiddlewareResult>;

/** Named middleware with metadata */
export interface Middleware {
  name: string;
  description?: string;
  priority?: number;
  execute: MiddlewareFn;
}

// ============================================================================
// Plugin Types
// ============================================================================

/** Plugin lifecycle hooks */
export interface PluginHooks {
  onInit?: (config: ChatConfig) => Promise<void>;
  onBeforeChat?: (context: MiddlewareContext) => Promise<MiddlewareContext>;
  onAfterChat?: (response: ChatResponse, context: MiddlewareContext) => Promise<ChatResponse>;
  onError?: (error: Error, context: MiddlewareContext) => Promise<void>;
  onDestroy?: () => Promise<void>;
}

/** Plugin definition */
export interface Plugin {
  name: string;
  version: string;
  description?: string;
  hooks: PluginHooks;
}

// ============================================================================
// Content Filter Types
// ============================================================================

/** Content filter result */
export const ContentFilterResultSchema = z.object({
  safe: z.boolean(),
  flags: z.array(
    z.object({
      type: z.enum(['profanity', 'pii', 'injection', 'harmful', 'custom']),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      match: z.string(),
      description: z.string().optional(),
    })
  ),
});
export type ContentFilterResult = z.infer<typeof ContentFilterResultSchema>;

/** Content filter rule */
export interface ContentFilterRule {
  name: string;
  type: 'profanity' | 'pii' | 'injection' | 'harmful' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
  pattern: RegExp;
  description?: string;
}
