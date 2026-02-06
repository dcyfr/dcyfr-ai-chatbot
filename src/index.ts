/**
 * @dcyfr/ai-chatbot - Conversational AI Template
 *
 * A comprehensive chatbot framework with:
 * - Multi-turn conversation management
 * - Streaming response support (SSE)
 * - Pluggable LLM providers (OpenAI, mock, custom)
 * - Memory strategies (in-memory, sliding window, summary)
 * - Middleware pipeline (rate limiting, content filtering, logging)
 * - Plugin system (personas, function calling)
 *
 * @example
 * ```typescript
 * import { ChatEngine, MockProvider } from '@dcyfr/ai-chatbot';
 *
 * const engine = new ChatEngine(
 *   { model: 'gpt-4o', systemPrompt: 'You are helpful.' },
 *   new MockProvider()
 * );
 *
 * const response = await engine.chat({ message: 'Hello!' });
 * console.log(response.message.content);
 * ```
 */

// Chat core
export { ChatEngine, ConversationManager } from './chat/index.js';
export {
  createMessage,
  estimateTokens,
  estimateMessagesTokens,
  formatMessages,
  validateMessageContent,
  truncateMessages,
} from './chat/index.js';

// Types
export type {
  Message,
  MessageRole,
  MessageMetadata,
  TokenUsage,
  ToolCall,
  ToolDefinition,
  Conversation,
  ConversationMetadata,
  ChatConfig,
  MemoryConfig,
  StreamConfig,
  RateLimitConfig,
  ChatRequest,
  ChatResponse,
  StreamChunk,
  StreamChunkType,
  ProviderConfig,
  ProviderRequest,
  ProviderResponse,
  ChatProvider,
  MiddlewareContext,
  MiddlewareResult,
  MiddlewareFn,
  Middleware,
  Plugin,
  PluginHooks,
  ContentFilterResult,
  ContentFilterRule,
} from './types/index.js';

// Schemas
export {
  MessageSchema,
  MessageRoleSchema,
  MessageMetadataSchema,
  TokenUsageSchema,
  ToolCallSchema,
  ToolDefinitionSchema,
  ConversationSchema,
  ConversationMetadataSchema,
  ChatConfigSchema,
  MemoryConfigSchema,
  StreamConfigSchema,
  RateLimitConfigSchema,
  ChatRequestSchema,
  ChatResponseSchema,
  StreamChunkSchema,
  StreamChunkTypeSchema,
  ProviderConfigSchema,
  ContentFilterResultSchema,
} from './types/index.js';

// Memory
export { InMemoryStorage, SlidingWindowMemory, SummaryMemory } from './memory/index.js';
export type { MemoryManager, MemoryStats, SlidingWindowOptions, SummaryMemoryOptions } from './memory/index.js';

// Streaming
export {
  formatSSE,
  createStreamChunk,
  StreamCollector,
  StreamHandler,
  TokenStreamer,
  transformStream,
  filterStream,
  collectStream,
} from './streaming/index.js';
export type { TokenStreamerOptions } from './streaming/index.js';

// Middleware
export {
  MiddlewarePipeline,
  createMiddleware,
  composeMiddleware,
  createRateLimiter,
  createContentFilter,
  filterContent,
  DEFAULT_FILTER_RULES,
  createLogger,
  LogStore,
} from './middleware/index.js';
export type { ContentFilterOptions, LogLevel, LogEntry, LoggerOptions } from './middleware/index.js';

// Providers
export { MockProvider, OpenAIProvider } from './providers/index.js';
export type { MockProviderOptions } from './providers/index.js';

// Plugins
export {
  PluginManager,
  createSystemPromptPlugin,
  BUILT_IN_PERSONAS,
  createFunctionCallingPlugin,
  defineTool,
} from './plugins/index.js';
export type {
  Persona,
  SystemPromptPluginOptions,
  FunctionCallingOptions,
} from './plugins/index.js';
