# API Reference

Complete API documentation for @dcyfr/ai-chatbot v1.0.0

## Table of Contents

- [Core Engine](#core-engine)
- [Providers](#providers)
- [Middleware](#middleware)
- [Plugins](#plugins)
- [Memory Strategies](#memory-strategies)
- [Streaming](#streaming)
- [Types](#types)

---

## Core Engine

### ChatEngine

Main engine for managing conversations, middleware, and LLM providers.

```typescript
import { ChatEngine } from '@dcyfr/ai-chatbot';
import { OpenAIProvider } from '@dcyfr/ai-chatbot/providers';

const engine = new ChatEngine(config, provider);
```

#### Constructor

```typescript
new ChatEngine(
  config: Partial<ChatConfig>,
  provider: ChatProvider
): ChatEngine
```

**Parameters:**

- `config` - Configuration options
  - `model?: string` - Model name (default: `'gpt-4o'`)
  - `temperature?: number` - Creativity level 0-1 (default: `0.7`)
  - `systemPrompt?: string` - System instructions
  - `maxTokens?: number` - Max tokens per response (default: `2000`)
  - `tools?: ToolDefinition[]` - Available tools for function calling
  - `memory?: MemoryConfig` - Memory strategy configuration
- `provider` - LLM provider instance

**Returns:** ChatEngine instance

#### Methods

##### chat()

Send a chat message and get a response.

```typescript
async chat(request: ChatRequest): Promise<ChatResponse>
```

**Parameters:**

```typescript
interface ChatRequest {
  message: string;
  role?: 'user' | 'assistant' | 'system';
  conversationId?: string;
  stream?: boolean;
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}
```

**Returns:**

```typescript
interface ChatResponse {
  message: Message;
  conversationId: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error';
  toolCalls?: ToolCall[];
}
```

**Example:**

```typescript
const response = await engine.chat({
  message: 'Hello, how are you?',
  conversationId: 'conv-123', // optional
});

console.log(response.message.content);
// => "Hello! I'm doing great, thank you for asking!"
```

##### stream()

Stream a chat response in real-time.

```typescript
async *stream(request: ChatRequest): AsyncIterable<StreamChunk>
```

**Parameters:** Same as `chat()`

**Yields:** `StreamChunk`

```typescript
interface StreamChunk {
  type: 'token' | 'done' | 'error' | 'usage';
  data: unknown;
  timestamp: number;
  metadata?: Record<string, unknown>;
}
```

**Example:**

```typescript
for await (const chunk of engine.stream({ message: 'Tell me a story' })) {
  if (chunk.type === 'token') {
    process.stdout.write(chunk.data as string);
  } else if (chunk.type === 'done') {
    console.log('\n[Complete]');
  }
}
```

##### use()

Register middleware.

```typescript
use(middleware: Middleware): ChatEngine
```

**Example:**

```typescript
import { createRateLimiter } from '@dcyfr/ai-chatbot/middleware';

engine.use(createRateLimiter({ maxRequestsPerMinute: 10 }));
```

##### registerPlugin()

Register a plugin.

```typescript
registerPlugin(plugin: Plugin): ChatEngine
```

**Example:**

```typescript
import { createFunctionCallingPlugin } from '@dcyfr/ai-chatbot/plugins';

engine.registerPlugin(createFunctionCallingPlugin({
  tools: [/* tool definitions */],
}));
```

##### registerTool()

Register a single tool.

```typescript
registerTool(tool: ToolDefinition): ChatEngine
```

##### init()

Initialize the engine (auto-called on first `chat()`).

```typescript
async init(): Promise<void>
```

##### destroy()

Clean up and reset engine state.

```typescript
async destroy(): Promise<void>
```

---

## Providers

### OpenAIProvider

OpenAI/Azure OpenAI provider.

```typescript
import { OpenAIProvider } from '@dcyfr/ai-chatbot/providers';

const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,
  organization: 'org-123', // optional
  baseURL: 'https://api.openai.com/v1', // optional
  timeout: 30000, // optional
});
```

**Configuration:**

```typescript
interface OpenAIProviderConfig {
  apiKey: string;
  organization?: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
}
```

### MockProvider

Testing provider with configurable responses.

```typescript
import { MockProvider } from '@dcyfr/ai-chatbot/providers';

const provider = new MockProvider({
  defaultResponse: 'Mock response',
  responses: new Map([
    ['hello', 'Hi there!'],
    ['help', 'How can I help you?'],
  ]),
  simulateErrors: false,
  errorRate: 0.1,
  streamDelay: 50,
});
```

---

## Middleware

### createRateLimiter()

Rate limiting middleware.

```typescript
import { createRateLimiter } from '@dcyfr/ai-chatbot/middleware';

const rateLimiter = createRateLimiter({
  maxRequestsPerMinute: 10,
  maxRequestsPerHour: 100,
});

engine.use(rateLimiter);
```

**Options:**

```typescript
interface RateLimiterOptions {
  maxRequestsPerMinute?: number;
  maxRequestsPerHour?: number;
  identifier?: (context: MiddlewareContext) => string;
}
```

### createLogger()

Structured logging middleware.

```typescript
import { createLogger } from '@dcyfr/ai-chatbot/middleware';

const logger = createLogger({
  level: 'info', // 'debug' | 'info' | 'warn' | 'error'
  logContent: false, // Don't log message content (privacy)
  handler: (entry) => {
    console.log(entry);
  },
});

engine.use(logger);
```

**Options:**

```typescript
interface LoggerOptions {
  level?: LogLevel;
  handler?: (entry: LogEntry) => void;
  logContent?: boolean;
}
```

### createContentFilter()

Content filtering middleware.

```typescript
import { createContentFilter } from '@dcyfr/ai-chatbot/middleware';

const filter = createContentFilter({
  blockedPatterns: [
    /\b(password|secret|key)\b/i,
    /ignore previous instructions/i,
  ],
  maxLength: 5000,
  allowedLanguages: ['en'],
});

engine.use(filter);
```

**Options:**

```typescript
interface ContentFilterOptions {
  blockedPatterns?: RegExp[];
  maxLength?: number;
  allowedLanguages?: string[];
}
```

### createMiddleware()

Create custom middleware.

```typescript
import { createMiddleware } from '@dcyfr/ai-chatbot/middleware';

const custom = createMiddleware(
  'my-middleware',
  async (context, next) => {
    console.log('Before processing');
    const result = await next();
    console.log('After processing');
    return result;
  },
  { priority: 0 }
);

engine.use(custom);
```

---

## Plugins

### createFunctionCallingPlugin()

Function/tool calling support.

```typescript
import { createFunctionCallingPlugin, defineTool } from '@dcyfr/ai-chatbot/plugins';

const plugin = createFunctionCallingPlugin({
  tools: [
    defineTool(
      'get_weather',
      'Get current weather',
      {
        type: 'object',
        properties: {
          location: { type: 'string' },
        },
        required: ['location'],
      },
      async (params) => {
        return { temperature: 72, location: params.location };
      }
    ),
  ],
  autoExecute: true,
  maxToolCallsPerTurn: 5,
});

engine.registerPlugin(plugin);
```

### createSystemPromptPlugin()

Dynamic system prompt management.

```typescript
import { createSystemPromptPlugin } from '@dcyfr/ai-chatbot/plugins';

const plugin = createSystemPromptPlugin({
  templates: {
    helpful: 'You are a helpful assistant.',
    creative: 'You are a creative storyteller.',
  },
  defaultTemplate: 'helpful',
});

engine.registerPlugin(plugin);
```

---

## Memory Strategies

### InMemoryStrategy

Simple in-memory conversation storage.

```typescript
import { InMemoryStrategy } from '@dcyfr/ai-chatbot/memory';

const engine = new ChatEngine({
  memory: {
    strategy: new InMemoryStrategy(),
    maxTokens: 4000,
  },
}, provider);
```

### SlidingWindowStrategy

Keeps only recent messages.

```typescript
import { SlidingWindowStrategy } from '@dcyfr/ai-chatbot/memory';

const engine = new ChatEngine({
  memory: {
    strategy: new SlidingWindowStrategy({ windowSize: 10 }),
    maxTokens: 4000,
  },
}, provider);
```

### SummaryStrategy

Summarizes old messages to save context.

```typescript
import { SummaryStrategy } from '@dcyfr/ai-chatbot/memory';

const engine = new ChatEngine({
  memory: {
    strategy: new SummaryStrategy({
      summaryThreshold: 20,
      keepRecentMessages: 10,
    }),
    maxTokens: 4000,
  },
}, provider);
```

---

## Streaming

### StreamCollector

Collect stream chunks into a complete response.

```typescript
import { StreamCollector } from '@dcyfr/ai-chatbot/streaming';

const collector = new StreamCollector();

for await (const chunk of engine.stream({ message: 'Hello' })) {
  collector.add(chunk);
}

console.log(collector.getContent());
console.log(`Received ${collector.count} chunks`);
```

### formatSSE()

Format chunks as Server-Sent Events.

```typescript
import { formatSSE, createStreamChunk } from '@dcyfr/ai-chatbot/streaming';

const chunk = createStreamChunk('token', 'Hello');
const sse = formatSSE(chunk);
// => "event: token\ndata: {...}\n\n"
```

---

## Types

### Core Types

```typescript
// Message
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  metadata?: {
    timestamp?: number;
    model?: string;
    tokens?: number;
    toolCallId?: string;
    toolName?: string;
  };
}

// Conversation
interface Conversation {
  id: string;
  messages: Message[];
  metadata: {
    systemPrompt?: string;
    model?: string;
    totalTokens: number;
    messageCount: number;
  };
  createdAt: number;
  updatedAt: number;
}

// Tool Definition
interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute?: (args: Record<string, unknown>) => Promise<unknown>;
}

// Tool Call
interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}
```

### Plugin Types

```typescript
interface Plugin {
  name: string;
  version: string;
  description?: string;
  hooks: {
    onInit?: (config: ChatConfig) => Promise<void>;
    onBeforeChat?: (context: MiddlewareContext) => Promise<MiddlewareContext>;
    onAfterChat?: (response: ChatResponse, context: MiddlewareContext) => Promise<ChatResponse>;
    onError?: (error: Error, context: MiddlewareContext) => Promise<void>;
    onDestroy?: () => Promise<void>;
  };
}
```

### Middleware Types

```typescript
interface Middleware {
  name: string;
  description?: string;
  priority?: number;
  execute: (
    context: MiddlewareContext,
    next: () => Promise<MiddlewareResult>
  ) => Promise<MiddlewareResult>;
}

interface MiddlewareContext {
  request: ChatRequest;
  conversation: Conversation;
  config: ChatConfig;
  metadata: Record<string, unknown>;
}

interface MiddlewareResult {
  proceed: boolean;
  context: MiddlewareContext;
  error?: string;
}
```

---

## Error Handling

All async methods can throw errors. Wrap in try-catch:

```typescript
try {
  const response = await engine.chat({ message: 'Hello' });
} catch (error) {
  if (error.message.includes('rate limit')) {
    console.error('Rate limited!');
  } else {
    console.error('Chat error:', error);
  }
}
```

---

**Version:** 1.0.0  
**Last Updated:** February 8, 2026  
**Full Documentation:** [https://github.com/dcyfr/dcyfr-ai-chatbot](https://github.com/dcyfr/dcyfr-ai-chatbot)
