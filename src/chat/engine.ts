/**
 * Chat Engine - Core conversation handler
 *
 * Orchestrates the full chat lifecycle: receives requests, applies middleware,
 * manages conversations, calls the LLM provider, streams responses, and
 * persists history.
 */

import type {
  ChatConfig,
  ChatProvider,
  ChatRequest,
  ChatResponse,
  Message,
  Middleware,
  MiddlewareContext,
  Plugin,
  StreamChunk,
  ToolCall,
  ToolDefinition,
} from '../types/index.js';
import { ChatConfigSchema } from '../types/index.js';
import { ConversationManager } from './conversation.js';
import { createMessage, estimateTokens, truncateMessages } from './message.js';

/**
 * Main chat engine that manages the conversation lifecycle
 */
export class ChatEngine {
  readonly config: ChatConfig;
  readonly conversations: ConversationManager;
  private provider: ChatProvider;
  private middlewares: Middleware[] = [];
  private plugins: Plugin[] = [];
  private tools: Map<string, ToolDefinition> = new Map();
  private initialized = false;

  constructor(config: Partial<ChatConfig>, provider: ChatProvider) {
    this.config = ChatConfigSchema.parse(config);
    this.provider = provider;
    this.conversations = new ConversationManager();

    // Register configured tools
    for (const tool of this.config.tools) {
      this.tools.set(tool.name, tool);
    }
  }

  /**
   * Initialize the engine and all plugins
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    for (const plugin of this.plugins) {
      if (plugin.hooks.onInit) {
        await plugin.hooks.onInit(this.config);
      }
    }
    this.initialized = true;
  }

  /**
   * Send a chat message and get a response
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!this.initialized) {
      await this.init();
    }

    // Get or create conversation
    const conversation = this.conversations.getOrCreate(
      request.conversationId ?? crypto.randomUUID(),
      { systemPrompt: this.config.systemPrompt, model: this.config.model }
    );

    // Build middleware context
    let context: MiddlewareContext = {
      request,
      conversation,
      config: this.config,
      metadata: {},
    };

    // Run before-chat plugins
    for (const plugin of this.plugins) {
      if (plugin.hooks.onBeforeChat) {
        context = await plugin.hooks.onBeforeChat(context);
      }
    }

    // Execute middleware pipeline
    const middlewareResult = await this.executeMiddleware(context);
    if (!middlewareResult.proceed) {
      const errorMsg = createMessage('assistant', middlewareResult.error ?? 'Request blocked by middleware');
      return {
        message: errorMsg,
        conversationId: conversation.id,
        finishReason: 'error',
      };
    }
    context = middlewareResult.context;

    // Add user message to conversation
    const userMessage = createMessage(request.role ?? 'user', request.message);
    this.conversations.addMessage(conversation.id, userMessage);

    // Build messages for the provider
    const messages = this.buildProviderMessages(conversation.id);

    // Resolve tools
    const tools = request.options?.tools ?? (this.tools.size > 0 ? Array.from(this.tools.values()) : undefined);

    // Call provider
    const startTime = Date.now();
    try {
      const providerResponse = await this.provider.complete({
        messages,
        model: request.options?.model ?? this.config.model,
        temperature: request.options?.temperature ?? this.config.temperature,
        maxTokens: request.options?.maxTokens ?? this.config.maxTokens,
        tools,
      });

      const latencyMs = Date.now() - startTime;

      // Create assistant message with metadata
      const assistantMessage = createMessage('assistant', providerResponse.message.content, {
        model: request.options?.model ?? this.config.model,
        tokens: providerResponse.usage.completionTokens,
        latencyMs,
        finishReason: providerResponse.finishReason,
      });

      this.conversations.addMessage(conversation.id, assistantMessage);

      // Handle tool calls
      if (providerResponse.toolCalls && providerResponse.toolCalls.length > 0) {
        await this.handleToolCalls(conversation.id, providerResponse.toolCalls);
      }

      let response: ChatResponse = {
        message: assistantMessage,
        conversationId: conversation.id,
        usage: providerResponse.usage,
        toolCalls: providerResponse.toolCalls,
        finishReason: providerResponse.finishReason,
      };

      // Run after-chat plugins
      for (const plugin of this.plugins) {
        if (plugin.hooks.onAfterChat) {
          response = await plugin.hooks.onAfterChat(response, context);
        }
      }

      return response;
    } catch (error) {
      // Run error plugins
      for (const plugin of this.plugins) {
        if (plugin.hooks.onError) {
          await plugin.hooks.onError(error as Error, context);
        }
      }
      throw error;
    }
  }

  /**
   * Stream a chat response
   */
  async *stream(request: ChatRequest): AsyncIterable<StreamChunk> {
    if (!this.initialized) {
      await this.init();
    }

    // Get or create conversation
    const conversation = this.conversations.getOrCreate(
      request.conversationId ?? crypto.randomUUID(),
      { systemPrompt: this.config.systemPrompt, model: this.config.model }
    );

    // Add user message
    const userMessage = createMessage(request.role ?? 'user', request.message);
    this.conversations.addMessage(conversation.id, userMessage);

    // Build messages
    const messages = this.buildProviderMessages(conversation.id);

    const tools = request.options?.tools ?? (this.tools.size > 0 ? Array.from(this.tools.values()) : undefined);

    // Stream from provider
    let fullContent = '';
    for await (const chunk of this.provider.stream({
      messages,
      model: request.options?.model ?? this.config.model,
      temperature: request.options?.temperature ?? this.config.temperature,
      maxTokens: request.options?.maxTokens ?? this.config.maxTokens,
      tools,
      stream: true,
    })) {
      if (chunk.type === 'token' && typeof chunk.data === 'string') {
        fullContent += chunk.data;
      }
      yield chunk;
    }

    // Save complete assistant message
    if (fullContent) {
      const assistantMessage = createMessage('assistant', fullContent, {
        model: request.options?.model ?? this.config.model,
        tokens: estimateTokens(fullContent),
      });
      this.conversations.addMessage(conversation.id, assistantMessage);
    }
  }

  /**
   * Register a middleware
   */
  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    this.middlewares.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    return this;
  }

  /**
   * Register a plugin
   */
  registerPlugin(plugin: Plugin): this {
    this.plugins.push(plugin);
    return this;
  }

  /**
   * Register a tool for function calling
   */
  registerTool(tool: ToolDefinition): this {
    this.tools.set(tool.name, tool);
    return this;
  }

  /**
   * Set the LLM provider
   */
  setProvider(provider: ChatProvider): this {
    this.provider = provider;
    return this;
  }

  /**
   * Get registered tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Destroy the engine and clean up
   */
  async destroy(): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.hooks.onDestroy) {
        await plugin.hooks.onDestroy();
      }
    }
    this.conversations.clear();
    this.middlewares = [];
    this.plugins = [];
    this.tools.clear();
    this.initialized = false;
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  private buildProviderMessages(conversationId: string): Message[] {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return [];

    // Add system message if configured
    const messages: Message[] = [];
    const systemPrompt = conversation.metadata.systemPrompt ?? this.config.systemPrompt;
    if (systemPrompt) {
      messages.push(createMessage('system', systemPrompt));
    }

    // Get conversation messages and truncate to fit context
    const convMessages = this.conversations.getMessages(conversationId);
    const truncated = truncateMessages(convMessages, this.config.memory.maxTokens);
    messages.push(...truncated);

    return messages;
  }

  private async handleToolCalls(conversationId: string, toolCalls: ToolCall[]): Promise<void> {
    for (const toolCall of toolCalls) {
      const tool = this.tools.get(toolCall.name);
      if (!tool || !tool.execute) {
        const errorMessage = createMessage('tool', `Tool not found: ${toolCall.name}`, {
          toolCallId: toolCall.id,
          toolName: toolCall.name,
        });
        this.conversations.addMessage(conversationId, errorMessage);
        continue;
      }

      try {
        const result = await tool.execute(toolCall.arguments);
        const resultMessage = createMessage(
          'tool',
          typeof result === 'string' ? result : JSON.stringify(result),
          { toolCallId: toolCall.id, toolName: toolCall.name }
        );
        this.conversations.addMessage(conversationId, resultMessage);
      } catch (error) {
        const errorMessage = createMessage(
          'tool',
          `Tool error: ${error instanceof Error ? error.message : String(error)}`,
          { toolCallId: toolCall.id, toolName: toolCall.name }
        );
        this.conversations.addMessage(conversationId, errorMessage);
      }
    }
  }

  private async executeMiddleware(
    context: MiddlewareContext
  ): Promise<{ proceed: boolean; context: MiddlewareContext; error?: string }> {
    if (this.middlewares.length === 0) {
      return { proceed: true, context };
    }

    let currentIndex = 0;
    let result: { proceed: boolean; context: MiddlewareContext; error?: string } = {
      proceed: true,
      context,
    };

    const next = async (): Promise<{ proceed: boolean; context: MiddlewareContext; error?: string }> => {
      if (currentIndex >= this.middlewares.length) {
        return { proceed: true, context: result.context };
      }

      const middleware = this.middlewares[currentIndex++];
      const mwResult = await middleware.execute(result.context, next);
      result = {
        proceed: mwResult.proceed,
        context: mwResult.context,
        error: mwResult.error,
      };
      return result;
    };

    return next();
  }
}
