<!-- TLP:CLEAR -->
# @dcyfr/ai-chatbot API Documentation

**Package:** `@dcyfr/ai-chatbot`  
**Current Version:** v0.2.0  
**License:** MIT  
**Repository:** [dcyfr/dcyfr-ai-chatbot](https://github.com/dcyfr/dcyfr-ai-chatbot)

**Information Classification:** TLP:CLEAR (Public)  
**Last Updated:** February 8, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [ChatEngine API](#chatengine-api)
5. [Providers](#providers)
6. [Conversation State Management](#conversation-state-management)
7. [Middleware System](#middleware-system)
8. [Plugin System](#plugin-system)
9. [Streaming](#streaming)
10. [Advanced Usage](#advanced-usage)
11. [TypeScript Signatures](#typescript-signatures)
12. [SemVer Commitment](#semver-commitment)

---

## Overview

`@dcyfr/ai-chatbot` is a production-ready framework for building conversational AI applications. It provides a complete toolkit for managing multi-turn conversations with streaming responses, persistent memory, middleware pipelines, and extensible plugins.

### Core Design Philosophy

- **Provider Agnostic:** Works with OpenAI-compatible APIs or custom providers
- **Minimal Dependencies:** Only `zod` as a runtime dependency (zero network dependencies)
- **Type Safety:** Full TypeScript coverage with runtime schema validation
- **Extensible:** Middleware and plugin architecture for customization
- **Production Ready:** 92.3% test coverage, comprehensive error handling

### Key Components

| Component | Purpose | Complexity |
|-----------|---------|------------|
| **ChatEngine** | Orchestrates conversations, middleware, and providers | Core |
| **ConversationManager** | Manages conversation state and history | Core |
| **Providers** | LLM backend abstraction (OpenAI, Mock, Custom) | Medium |
| **Memory Strategies** | Conversation state persistence (InMemory, SlidingWindow, Summary) | Advanced |
| **Middleware** | Request/response pipeline (RateLimiter, ContentFilter, Logger) | Medium |
| **Plugins** | Feature extensions (SystemPrompt, FunctionCalling) | Advanced |
| **Streaming** | Token-by-token SSE streaming with backpressure | Advanced |

---

## Installation

### NPM

```bash
npm install @dcyfr/ai-chatbot
```

### Peer Dependencies

The chatbot framework has **minimal runtime dependencies**:

- `zod` (required): Schema validation and type inference

For OpenAI provider (optional):
- Environment variable: `OPENAI_API_KEY` (or provide via config)

### TypeScript Configuration

Recommended `tsconfig.json` settings:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
```

---

## Quick Start

### Example 1: Basic Chatbot

```typescript
import { ChatEngine, MockProvider } from '@dcyfr/ai-chatbot';

// Create a chatbot with mock provider (no API key needed)
const bot = new ChatEngine(
  {
    model: 'gpt-4o',
    systemPrompt: 'You are a helpful assistant.',
    temperature: 0.7,
    maxTokens: 2048,
  },
  new MockProvider()
);

// Single-turn conversation
const response = await bot.chat({
  message: 'What is TypeScript?',
  conversationId: 'user-123',
});

console.log(response.message.content);
// Output: "Mock response to: What is TypeScript?"
```

### Example 2: Streaming Responses

```typescript
import { ChatEngine, MockProvider } from '@dcyfr/ai-chatbot';

const bot = new ChatEngine({ model: 'gpt-4o' }, new MockProvider());

// Stream tokens as they arrive
for await (const chunk of bot.stream({
  message: 'Tell me a story',
  conversationId: 'user-123',
})) {
  if (chunk.type === 'token') {
    process.stdout.write(chunk.data as string);
  } else if (chunk.type === 'done') {
    console.log('\n\nMetadata:', chunk.data);
  }
}
```

### Example 3: With OpenAI Provider

```typescript
import { ChatEngine, OpenAIProvider } from '@dcyfr/ai-chatbot';

const bot = new ChatEngine(
  {
    model: 'gpt-4o',
    systemPrompt: 'You are a concise assistant.',
  },
  new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!,
    baseURL: 'https://api.openai.com/v1', // Optional: custom endpoint
    timeout: 30000, // 30 seconds
  })
);

const response = await bot.chat({
  message: 'Explain quantum computing in one sentence',
  conversationId: 'user-123',
});

console.log(response.message.content);
```

---

## ChatEngine API

### Constructor

```typescript
new ChatEngine(config: ChatConfig, provider: ChatProvider)
```

**Parameters:**
- `config`: Global configuration for all conversations
- `provider`: LLM provider instance (OpenAI, Mock, or custom)

**ChatConfig Interface:**

```typescript
interface ChatConfig {
  model: string;                    // Model identifier (e.g., 'gpt-4o')
  systemPrompt?: string;            // Global system prompt
  temperature?: number;             // 0-2, creativity level (default: 0.7)
  maxTokens?: number;               // Max tokens in response (default: 2048)
  topP?: number;                    // Nucleus sampling (default: 1.0)
  frequencyPenalty?: number;        // -2.0 to 2.0 (default: 0)
  presencePenalty?: number;         // -2.0 to 2.0 (default: 0)
  timeout?: number;                 // Request timeout in ms (default: 30000)
  memory?: MemoryManager;           // Custom memory strategy (default: InMemoryStorage)
  stream?: StreamConfig;            // Streaming configuration
}
```

### Core Methods

#### chat()

Non-streaming chat completion.

```typescript
async chat(request: ChatRequest): Promise<ChatResponse>
```

**Request:**
```typescript
interface ChatRequest {
  message: string;                  // User message content
  conversationId?: string;          // Conversation ID (default: 'default')
  metadata?: MessageMetadata;       // Custom metadata
}
```

**Response:**
```typescript
interface ChatResponse {
  message: Message;                 // Assistant's response message
  usage?: TokenUsage;               // Token consumption stats
  finishReason?: FinishReason;      // 'stop' | 'length' | 'tool_calls' | 'content_filter'
  metadata?: Record<string, any>;   // Provider-specific metadata
}
```

**Example with Metadata:**

```typescript
const response = await bot.chat({
  message: 'Hello!',
  conversationId: 'session-abc123',
  metadata: {
    userId: 'user-456',
    tags: ['greeting', 'onboarding'],
  },
});

console.log(response.message.content);
console.log('Tokens used:', response.usage?.total);
```

#### stream()

Streaming chat completion (SSE).

```typescript
async *stream(request: ChatRequest): AsyncGenerator<StreamChunk>
```

**StreamChunk Types:**

```typescript
type StreamChunkType = 'token' | 'done' | 'error' | 'ping';

interface StreamChunk {
  type: StreamChunkType;
  data: string | TokenUsage | Error;
  timestamp: number;
}
```

**Example with Error Handling:**

```typescript
try {
  for await (const chunk of bot.stream({ message: 'Hello' })) {
    switch (chunk.type) {
      case 'token':
        process.stdout.write(chunk.data as string);
        break;
      case 'done':
        console.log('\nUsage:', chunk.data);
        break;
      case 'error':
        throw chunk.data;
      case 'ping':
        // Keep-alive heartbeat (every 15s during long processing)
        break;
    }
  }
} catch (error) {
  console.error('Stream error:', error);
}
```

#### use()

Register middleware in the request/response pipeline.

```typescript
use(middleware: Middleware): void
```

**Example:**

```typescript
import { createRateLimiter, createLogger } from '@dcyfr/ai-chatbot';

bot.use(createRateLimiter({ maxRequests: 60, windowMs: 60000 }));
bot.use(createLogger({ level: 'info' }));
```

Middleware executes in **registration order** (first registered, first executed).

#### registerPlugin()

Register a plugin for lifecycle hooks.

```typescript
registerPlugin(plugin: Plugin): void
```

**Example:**

```typescript
import { createSystemPromptPlugin, BUILT_IN_PERSONAS } from '@dcyfr/ai-chatbot';

bot.registerPlugin(
  createSystemPromptPlugin({
    persona: BUILT_IN_PERSONAS.TECHNICAL_EXPERT,
  })
);
```

#### getConversationManager()

Access the underlying conversation manager for direct state manipulation.

```typescript
getConversationManager(): ConversationManager
```

**Example:**

```typescript
const manager = bot.getConversationManager();

// Get conversation history
const history = await manager.getHistory('user-123');
console.log(`${history.length} messages in history`);

// Clear conversation
await manager.clear('user-123');
```

---

## Providers

### OpenAIProvider

Production provider for OpenAI-compatible APIs (OpenAI, Azure OpenAI, compatible endpoints).

```typescript
import { OpenAIProvider } from '@dcyfr/ai-chatbot';

const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
  baseURL: 'https://api.openai.com/v1',  // Optional: custom endpoint
  timeout: 30000,                          // Optional: request timeout (ms)
});
```

**Configuration:**

```typescript
interface OpenAIProviderOptions {
  apiKey: string;                    // API key (required)
  baseURL?: string;                  // API endpoint (default: OpenAI)
  timeout?: number;                  // Request timeout in ms (default: 30000)
  organization?: string;             // OpenAI organization ID
}
```

**Supported Models:**
- GPT-4 family: `gpt-4o`, `gpt-4-turbo`, `gpt-4`
- GPT-3.5 family: `gpt-3.5-turbo`
- Azure OpenAI: Custom deployment names

**Tool Calling Support:**

```typescript
import { defineTool } from '@dcyfr/ai-chatbot';

const weatherTool = defineTool({
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name' },
    },
    required: ['location'],
  },
});

const response = await bot.chat({
  message: 'What\'s the weather in Tokyo?',
  // Tool calls will be included in response.message.toolCalls
});

if (response.message.toolCalls) {
  console.log('Tool requested:', response.message.toolCalls[0].name);
}
```

### MockProvider

Test provider with deterministic responses (no API calls).

```typescript
import { MockProvider } from '@dcyfr/ai-chatbot';

const provider = new MockProvider({
  delay: 100,                        // Simulate network delay (ms)
  response: 'Custom mock response',  // Custom response text
  streaming: true,                   // Enable streaming simulation
});
```

**Use Cases:**
- Unit testing without API costs
- Development without API keys
- Integration test fixtures
- Performance benchmarking

**Example Test:**

```typescript
import { describe, it, expect } from 'vitest';
import { ChatEngine, MockProvider } from '@dcyfr/ai-chatbot';

describe('Chatbot', () => {
  it('should respond to messages', async () => {
    const bot = new ChatEngine(
      { model: 'gpt-4o' },
      new MockProvider({ response: 'Test response' })
    );
    
    const response = await bot.chat({ message: 'Hello' });
    expect(response.message.content).toBe('Test response');
  });
});
```

### Custom Provider

Implement the `ChatProvider` interface for custom backends.

```typescript
interface ChatProvider {
  complete(request: ProviderRequest): Promise<ProviderResponse>;
  stream?(request: ProviderRequest): AsyncGenerator<string>;
}
```

**Example: Anthropic Claude Provider**

```typescript
import type { ChatProvider, ProviderRequest, ProviderResponse } from '@dcyfr/ai-chatbot';

class AnthropicProvider implements ChatProvider {
  constructor(private apiKey: string) {}

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
        max_tokens: request.maxTokens || 2048,
      }),
    });

    const data = await response.json();
    
    return {
      content: data.content[0].text,
      finishReason: data.stop_reason === 'end_turn' ? 'stop' : 'length',
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        total: data.usage.input_tokens + data.usage.output_tokens,
      },
    };
  }
}

// Usage
const bot = new ChatEngine(
  { model: 'claude-3-opus-20240229' },
  new AnthropicProvider(process.env.ANTHROPIC_API_KEY!)
);
```

---

## Conversation State Management

**⭐ Critical for Multi-Turn Conversations**

The chatbot framework provides three memory strategies for managing conversation state, each optimized for different use cases and scale requirements.

### Memory Strategy Comparison

| Strategy | Use Case | Memory Usage | Best For |
|----------|----------|--------------|----------|
| **InMemoryStorage** | Default, full history | O(n) per conversation | Development, small-scale apps |
| **SlidingWindow** | Recent N messages | O(k) constant | Production apps, balanced history |
| **SummaryMemory** | Summarized old messages | O(k + s), s=summary | Long conversations, cost optimization |

### InMemoryStorage

Simplest strategy: stores all messages in a JavaScript `Map`.

```typescript
import { ChatEngine, MockProvider, InMemoryStorage } from '@dcyfr/ai-chatbot';

const bot = new ChatEngine(
  {
    model: 'gpt-4o',
    memory: new InMemoryStorage(),
  },
  new MockProvider()
);

// Every message is retained in full
await bot.chat({ message: 'Message 1', conversationId: 'user-123' });
await bot.chat({ message: 'Message 2', conversationId: 'user-123' });

const manager = bot.getConversationManager();
const history = await manager.getHistory('user-123');
console.log(`${history.length} messages stored`); // 4 (2 user + 2 assistant)
```

**Characteristics:**
- **Pros:** Simple, fast lookup, complete history
- **Cons:** Unbounded memory growth, not suitable for long conversations
- **Memory:** O(n) where n = total messages
- **Persistence:** In-memory only (lost on restart)

### SlidingWindowMemory

Keeps the most recent N messages, discards older ones.

```typescript
import { ChatEngine, MockProvider, SlidingWindowMemory } from '@dcyfr/ai-chatbot';

const bot = new ChatEngine(
  {
    model: 'gpt-4o',
    memory: new SlidingWindowMemory({
      windowSize: 10,              // Keep last 10 messages
      keepSystemMessages: true,    // Always retain system prompts
    }),
  },
  new MockProvider()
);

// After 11+ messages, oldest non-system messages are discarded
for (let i = 0; i < 20; i++) {
  await bot.chat({
    message: `Message ${i}`,
    conversationId: 'user-123',
  });
}

const manager = bot.getConversationManager();
const history = await manager.getHistory('user-123');
console.log(`${history.length} messages stored`); // 10 (or 11 with system message)
```

**Configuration:**

```typescript
interface SlidingWindowOptions {
  windowSize: number;              // Number of messages to retain
  keepSystemMessages?: boolean;    // Keep system messages outside window (default: true)
  maxTokens?: number;              // Optional: truncate by token budget instead
}
```

**Token-Based Window:**

```typescript
const bot = new ChatEngine(
  {
    model: 'gpt-4o',
    memory: new SlidingWindowMemory({
      windowSize: 20,
      maxTokens: 4096,  // Enforce token budget (tight models like gpt-3.5-turbo)
    }),
  },
  new MockProvider()
);

// Window dynamically shrinks to fit under 4096 tokens
```

**Characteristics:**
- **Pros:** Bounded memory, production-ready, fast
- **Cons:** Loses old context, may forget earlier conversation points
- **Memory:** O(k) where k = windowSize
- **Best For:** Most production applications (10-50 message window)

### SummaryMemory

Advanced strategy: keeps recent messages in full, summarizes older messages.

```typescript
import { ChatEngine, MockProvider, SummaryMemory } from '@dcyfr/ai-chatbot';

const bot = new ChatEngine(
  {
    model: 'gpt-4o',
    memory: new SummaryMemory({
      recentCount: 10,               // Keep last 10 messages in full
      maxSummaryTokens: 500,         // Summary budget
      summarizer: async (messages) => {
        // Custom summarizer (default: simple concatenation)
        const contents = messages.map(m => m.content).join('\n');
        return `Summary of ${messages.length} messages:\n${contents.slice(0, 500)}`;
      },
    }),
  },
  new MockProvider()
);

// After 11+ messages, oldest messages are summarized
for (let i = 0; i < 30; i++) {
  await bot.chat({ message: `Message ${i}`, conversationId: 'user-123' });
}

const manager = bot.getConversationManager();
const memory = bot.getConversationManager().getMemory() as SummaryMemory;
const summary = memory.getSummary('user-123');
console.log('Conversation summary:', summary);
```

**Configuration:**

```typescript
interface SummaryMemoryOptions {
  recentCount: number;                       // Messages to keep in full
  maxTokens?: number;                        // Total token budget (summary + recent)
  maxSummaryTokens?: number;                 // Summary size limit
  summarizer?: (messages: Message[]) => Promise<string>;  // Custom summarizer
}
```

**Custom LLM Summarizer:**

```typescript
import { ChatEngine, OpenAIProvider, SummaryMemory } from '@dcyfr/ai-chatbot';

const summarizerBot = new ChatEngine(
  { model: 'gpt-3.5-turbo' },
  new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! })
);

const mainBot = new ChatEngine(
  {
    model: 'gpt-4o',
    memory: new SummaryMemory({
      recentCount: 10,
      maxSummaryTokens: 500,
      summarizer: async (messages) => {
        // Use GPT-3.5 to summarize old messages
        const response = await summarizerBot.chat({
          message: `Summarize this conversation in 3 sentences:\n\n${
            messages.map(m => `${m.role}: ${m.content}`).join('\n')
          }`,
          conversationId: 'summarizer',
        });
        return response.message.content;
      },
    }),
  },
  new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! })
);
```

**Characteristics:**
- **Pros:** Balance between context and memory, ideal for long conversations
- **Cons:** Summarization latency, complexity
- **Memory:** O(recentCount + summary_size)
- **Best For:** Long-running conversations, customer support, therapy bots

### Multi-User Conversations

All memory strategies support isolated conversation state per `conversationId`.

```typescript
import { ChatEngine, MockProvider, SlidingWindowMemory } from '@dcyfr/ai-chatbot';

const bot = new ChatEngine(
  {
    model: 'gpt-4o',
    memory: new SlidingWindowMemory({ windowSize: 20 }),
  },
  new MockProvider()
);

// User A's conversation
await bot.chat({ message: 'Hello', conversationId: 'user-a' });

// User B's conversation (completely isolated)
await bot.chat({ message: 'Hi', conversationId: 'user-b' });

// Each user has separate history
const managerA = bot.getConversationManager();
const historyA = await managerA.getHistory('user-a');
const historyB = await managerA.getHistory('user-b');

console.log('User A messages:', historyA.length); // 2 (user + assistant)
console.log('User B messages:', historyB.length); // 2 (user + assistant)
```

**Production Pattern: User ID as Conversation ID**

```typescript
// Express.js example
app.post('/api/chat', async (req, res) => {
  const userId = req.user.id;  // From authentication middleware
  const { message } = req.body;

  const response = await bot.chat({
    message,
    conversationId: userId,  // Isolate per user
    metadata: {
      userId,
      sessionId: req.session.id,
      timestamp: Date.now(),
    },
  });

  res.json(response);
});
```

### Conversation Persistence

Memory strategies are in-memory by default. For persistence across restarts:

**Pattern 1: Manual Save/Load**

```typescript
import { ChatEngine, SlidingWindowMemory } from '@dcyfr/ai-chatbot';
import fs from 'fs/promises';

const memory = new SlidingWindowMemory({ windowSize: 20 });
const bot = new ChatEngine({ model: 'gpt-4o', memory }, provider);

// Save conversations to disk
async function saveConversations() {
  const manager = bot.getConversationManager();
  const allConvIds = await manager.getAllConversationIds();
  
  for (const convId of allConvIds) {
    const history = await manager.getHistory(convId);
    await fs.writeFile(
      `conversations/${convId}.json`,
      JSON.stringify(history, null, 2)
    );
  }
}

// Restore on startup
async function loadConversations() {
  const files = await fs.readdir('conversations');
  for (const file of files) {
    const convId = file.replace('.json', '');
    const history = JSON.parse(await fs.readFile(`conversations/${file}`, 'utf8'));
    
    await memory.save(convId, history);
  }
}

// Periodic saves
setInterval(saveConversations, 60000); // Every minute
```

**Pattern 2: Database-Backed Memory (Custom)**

```typescript
import type { MemoryManager, Message, MemoryStats } from '@dcyfr/ai-chatbot';
import { PrismaClient } from '@prisma/client';

class DatabaseMemory implements MemoryManager {
  constructor(private db: PrismaClient) {}

  async save(conversationId: string, messages: Message[]): Promise<void> {
    await this.db.conversation.upsert({
      where: { id: conversationId },
      update: {
        messages: JSON.stringify(messages),
        updatedAt: new Date(),
      },
      create: {
        id: conversationId,
        messages: JSON.stringify(messages),
      },
    });
  }

  async load(conversationId: string): Promise<Message[]> {
    const conv = await this.db.conversation.findUnique({
      where: { id: conversationId },
    });
    return conv ? JSON.parse(conv.messages) : [];
  }

  async getContext(conversationId: string, maxTokens?: number): Promise<Message[]> {
    return this.load(conversationId);
  }

  // ... implement other methods
}

const bot = new ChatEngine(
  { model: 'gpt-4o', memory: new DatabaseMemory(prisma) },
  provider
);
```

---

## Middleware System

Middleware intercepts requests/responses for cross-cutting concerns (logging, rate limiting, content filtering).

### Middleware Execution Flow

```
Request → Middleware 1 → Middleware 2 → ... → Provider → LLM
                ↓              ↓                    ↓
              Logger      RateLimiter         ContentFilter
                ↓              ↓                    ↓
Response ← Middleware 1 ← Middleware 2 ← ... ← Provider ← LLM
```

### Built-In Middleware

#### createRateLimiter()

Prevents abuse by limiting requests per time window.

```typescript
import { createRateLimiter } from '@dcyfr/ai-chatbot';

bot.use(createRateLimiter({
  maxRequests: 60,              // 60 requests
  windowMs: 60000,              // per 60 seconds (1 minute)
  strategy: 'token-bucket',     // 'sliding-window' | 'token-bucket'
  keyGenerator: (ctx) => ctx.request.conversationId || 'default',  // Custom key
}));
```

**Strategies:**
- `sliding-window`: Simple count in time window (default)
- `token-bucket`: Allows bursts, then drains token bucket

**Rate Limit Exceeded:**

```typescript
// Throws error with 429 status
try {
  await bot.chat({ message: 'Too many requests' });
} catch (error) {
  if (error instanceof Error && error.message.includes('Rate limit')) {
    console.log('Please wait before sending more messages');
  }
}
```

#### createContentFilter()

Blocks inappropriate content based on rules.

```typescript
import { createContentFilter, DEFAULT_FILTER_RULES } from '@dcyfr/ai-chatbot';

bot.use(createContentFilter({
  useDefaults: true,            // Use built-in rules (profanity, PII)
  blockSeverity: 'high',        // 'low' | 'medium' | 'high'
  customRules: [
    {
      name: 'no-credit-cards',
      pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/,
      severity: 'high',
      action: 'block',
    },
  ],
}));
```

**Default Rules:**
- Profanity detection
- Email addresses (PII)
- Phone numbers (PII)
- Social Security Numbers
- Credit card patterns

**Content Blocked:**

```typescript
try {
  await bot.chat({ message: 'My SSN is 123-45-6789' });
} catch (error) {
  // Throws with blocked content details
  console.error('Message blocked by content filter');
}
```

#### createLogger()

Logs requests, responses, and errors.

```typescript
import { createLogger } from '@dcyfr/ai-chatbot';

bot.use(createLogger({
  level: 'info',                // 'debug' | 'info' | 'warn' | 'error'
  handler: (entry) => {
    // Custom log handler
    console.log(`[${entry.level}] ${entry.message}`, entry.data);
  },
}));
```

**Log Output:**

```
[INFO] chat.request (user-123) { messageLength: 24, model: 'gpt-4o' }
[INFO] chat.response (user-123) { durationMs: 342, tokens: 156 }
```

### Custom Middleware

Implement the `Middleware` interface:

```typescript
import type { Middleware, MiddlewareContext, MiddlewareResult } from '@dcyfr/ai-chatbot';

const timingMiddleware: Middleware = {
  name: 'timing',
  async before(ctx: MiddlewareContext): Promise<MiddlewareResult> {
    ctx.metadata.startTime = Date.now();
    return { proceed: true };
  },
  async after(ctx: MiddlewareContext): Promise<void> {
    const duration = Date.now() - ctx.metadata.startTime;
    console.log(`Request took ${duration}ms`);
  },
};

bot.use(timingMiddleware);
```

**Blocking Middleware:**

```typescript
const authMiddleware: Middleware = {
  name: 'auth',
  async before(ctx): Promise<MiddlewareResult> {
    const userId = ctx.request.metadata?.userId;
    
    if (!userId || !await isUserAuthorized(userId)) {
      return {
        proceed: false,
        error: new Error('Unauthorized'),
      };
    }
    
    return { proceed: true };
  },
};
```

---

## Plugin System

Plugins extend chatbot functionality via lifecycle hooks.

### Built-In Plugins

#### createSystemPromptPlugin()

Injects system prompts with persona templates.

```typescript
import { createSystemPromptPlugin, BUILT_IN_PERSONAS } from '@dcyfr/ai-chatbot';

bot.registerPlugin(
  createSystemPromptPlugin({
    persona: BUILT_IN_PERSONAS.TECHNICAL_EXPERT,
    // Or custom persona:
    // persona: {
    //   role: 'Senior Software Engineer',
    //   traits: ['precise', 'helpful', 'code-focused'],
    //   instructions: 'Provide code examples with TypeScript',
    // },
  })
);
```

**Built-In Personas:**
- `HELPFUL_ASSISTANT` - Friendly, general-purpose
- `TECHNICAL_EXPERT` - Code-focused, precise
- `CREATIVE_WRITER` - Imaginative, expressive
- `TUTOR` - Patient, educational

#### createFunctionCallingPlugin()

Enables LLM tool/function calling.

```typescript
import { createFunctionCallingPlugin, defineTool } from '@dcyfr/ai-chatbot';

const weatherTool = defineTool({
  name: 'get_weather',
  description: 'Get current weather for a city',
  parameters: {
    type: 'object',
    properties: {
      city: { type: 'string', description: 'City name' },
      units: { type: 'string', enum: ['celsius', 'fahrenheit'] },
    },
    required: ['city'],
  },
  handler: async ({ city, units }) => {
    // Call weather API
    const weather = await fetchWeather(city);
    return {
      temperature: units === 'celsius' ? weather.tempC : weather.tempF,
      condition: weather.condition,
    };
  },
});

bot.registerPlugin(
  createFunctionCallingPlugin({
    tools: [weatherTool],
    autoExecute: true,  // Automatically execute tool calls
  })
);

// LLM can now call get_weather
const response = await bot.chat({
  message: 'What's the weather in Paris?',
});
// Response will include weather data from tool execution
```

### Custom Plugins

Implement the `Plugin` interface:

```typescript
import type { Plugin, PluginHooks } from '@dcyfr/ai-chatbot';

const analyticsPlugin: Plugin = {
  name: 'analytics',
  hooks: {
    async beforeRequest(ctx) {
      console.log('Analytics: Request started', ctx.request);
    },
    async afterResponse(ctx, response) {
      console.log('Analytics: Response received', {
        conversationId: ctx.request.conversationId,
        tokens: response.usage?.total,
      });
      
      // Send to analytics service
      await analytics.track('chat_completion', {
        userId: ctx.request.metadata?.userId,
        tokens: response.usage?.total,
        model: ctx.config.model,
      });
    },
    async onError(ctx, error) {
      console.error('Analytics: Error occurred', error);
      await analytics.trackError(error);
    },
  },
};

bot.registerPlugin(analyticsPlugin);
```

---

## Streaming

Server-Sent Events (SSE) streaming for token-by-token responses.

### StreamHandler

High-level streaming utility with backpressure support.

```typescript
import { StreamHandler } from '@dcyfr/ai-chatbot';

const handler = new StreamHandler({
  onToken: (token: string) => {
    process.stdout.write(token);
  },
  onDone: (usage) => {
    console.log('\n\nTokens used:', usage.total);
  },
  onError: (error) => {
    console.error('Stream error:', error);
  },
});

// Attach to bot stream
for await (const chunk of bot.stream({ message: 'Hello' })) {
  await handler.handle(chunk);
}
```

### TokenStreamer

Low-level streaming with custom transformations.

```typescript
import { TokenStreamer } from '@dcyfr/ai-chatbot';

const streamer = new TokenStreamer({
  chunkSize: 5,                // Batch 5 tokens together
  debounceMs: 50,              // Debounce rapid tokens
});

for await (const chunk of bot.stream({ message: 'Tell me a story' })) {
  if (chunk.type === 'token') {
    const batched = streamer.process(chunk.data as string);
    if (batched) {
      process.stdout.write(batched);
    }
  }
}

// Flush remaining tokens
const remaining = streamer.flush();
if (remaining) {
  process.stdout.write(remaining);
}
```

### SSE Format

Streams use Server-Sent Events format:

```
data: {"type":"token","data":"Hello","timestamp":1234567890}

data: {"type":"token","data":" world","timestamp":1234567891}

data: {"type":"done","data":{"total":15},"timestamp":1234567892}
```

---

## Advanced Usage

### Error Handling

All errors are typed and include context:

```typescript
try {
  await bot.chat({ message: 'Hello' });
} catch (error) {
  if (error instanceof Error) {
    switch (error.name) {
      case 'RateLimitError':
        console.error('Too many requests. Please wait.');
        break;
      case 'ContentFilterError':
        console.error('Message blocked by content filter');
        break;
      case 'ProviderError':
        console.error('LLM provider error:', error.message);
        break;
      default:
        console.error('Unknown error:', error);
    }
  }
}
```

### Configuration Overrides

Override config per request:

```typescript
const response = await bot.chat(
  { message: 'Quick response' },
  {
    temperature: 0.3,       // Override global temperature
    maxTokens: 100,         // Shorter response
    timeout: 10000,         // 10s timeout
  }
);
```

### Conversation Search

Search messages across all conversations:

```typescript
const manager = bot.getConversationManager();
const results = await manager.search('user-123', 'typescript', 10);

results.forEach(msg => {
  console.log(`${msg.role}: ${msg.content}`);
});
```

---

## TypeScript Signatures

### Core Types

```typescript
// Messages
interface Message {
  id: string;
  role: MessageRole;           // 'system' | 'user' | 'assistant' | 'function'
  content: string;
  name?: string;
  toolCalls?: ToolCall[];
  metadata: MessageMetadata;
}

interface MessageMetadata {
  timestamp: number;
  conversationId?: string;
  userId?: string;
  tags?: string[];
  [key: string]: any;
}

// Token usage
interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  total: number;
}

// Tool calling
interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;         // JSON string
  };
}

interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
    handler?: (args: any) => Promise<any>;
  };
}
```

### Provider Types

```typescript
interface ChatProvider {
  complete(request: ProviderRequest): Promise<ProviderResponse>;
  stream?(request: ProviderRequest): AsyncGenerator<string>;
}

interface ProviderRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  tools?: ToolDefinition[];
}

interface ProviderResponse {
  content: string;
  finishReason?: FinishReason;
  usage?: TokenUsage;
  toolCalls?: ToolCall[];
}
```

---

## SemVer Commitment

### Versioning Policy

`@dcyfr/ai-chatbot` follows [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR** (x.0.0): Breaking changes to public API
- **MINOR** (0.x.0): New features, backward-compatible
- **PATCH** (0.0.x): Bug fixes, backward-compatible

**Current Status:** Pre-v1.0.0 (beta phase)

### Breaking Change Process

Before v1.0.0, breaking changes may occur in minor versions. After v1.0.0:

1. **Deprecation Warning:** At least 1 minor version notice
2. **Migration Guide:** Detailed upgrade instructions
3. **Codemods:** Automated migration tools when possible
4. **Support Window:** Deprecated APIs supported for 6 months minimum

### API Stability Guarantees (v1.0.0+)

**Stable (will not break without major version):**
- `ChatEngine` constructor and core methods (`chat()`, `stream()`, `use()`)
- Provider interfaces (`ChatProvider`, `complete()`, `stream()`)
- Memory interfaces (`MemoryManager`, `save()`, `load()`)
- Message structure and types
- Built-in middleware and plugins

**Experimental (may change in minor versions):**
- Plugin hooks structure (may add new hooks)
- Streaming chunk formats (may add new chunk types)
- Internal implementation details

**Documentation:**
- API changes documented in CHANGELOG.md
- Migration guides in docs/guides/
- Breaking changes highlighted in release notes

---

## Support & Resources

- **Documentation:** [GitHub README](https://github.com/dcyfr/dcyfr-ai-chatbot)
- **Examples:** [examples/](https://github.com/dcyfr/dcyfr-ai-chatbot/tree/main/examples)
- **Issues:** [GitHub Issues](https://github.com/dcyfr/dcyfr-ai-chatbot/issues)
- **Security:** [SECURITY.md](https://github.com/dcyfr/dcyfr-ai-chatbot/blob/main/SECURITY.md)
- **License:** MIT

---

**Last Updated:** February 8, 2026  
**Document Version:** 1.0.0  
**Package Version:** v0.2.0  
**Maintained By:** DCYFR AI Team
