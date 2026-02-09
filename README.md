# @dcyfr/ai-chatbot

> Conversational AI chatbot template — DCYFR AI starter

A comprehensive framework for building multi-turn conversational AI applications with streaming responses, memory management, middleware, and plugin support.

> **📦 Starter Template** — This is a **starter template** for cloning, not an npm package. Use `git clone` or download the source to create your own chatbot application. This package is marked `private: true` and is not published to npm.

## Features

- **Multi-turn Conversations** — Persistent conversation history with threading
- **Streaming Responses** — Token-by-token SSE streaming with backpressure
- **Memory Strategies** — In-memory, sliding window, and summary-based memory
- **Middleware Pipeline** — Rate limiting, content filtering, and logging
- **Plugin System** — Personas, function calling, and custom extensions
- **Provider Abstraction** — OpenAI-compatible API, mock provider for testing
- **Type-Safe** — Full TypeScript with Zod schema validation
- **Zero External Dependencies** — Only `zod` as a runtime dependency

## Quick Start

```bash
# Install dependencies
npm install

# Run with mock provider
npx tsx examples/simple-chat/index.ts

# Run streaming example
npx tsx examples/streaming-chat/index.ts

# Run advanced example (middleware + plugins)
npx tsx examples/advanced-chat/index.ts
```

## Usage

### Basic Chat

```typescript
import { ChatEngine, MockProvider } from '@dcyfr/ai-chatbot';

const engine = new ChatEngine(
  {
    model: 'gpt-4o',
    systemPrompt: 'You are a helpful assistant.',
    temperature: 0.7,
  },
  new MockProvider()
);

const response = await engine.chat({ message: 'Hello!' });
console.log(response.message.content);
```

### Streaming

```typescript
for await (const chunk of engine.stream({ message: 'Tell me a story' })) {
  if (chunk.type === 'token') {
    process.stdout.write(chunk.data as string);
  }
}
```

### With Middleware

```typescript
import {
  ChatEngine,
  MockProvider,
  createRateLimiter,
  createContentFilter,
  createLogger,
} from '@dcyfr/ai-chatbot';

const engine = new ChatEngine({ model: 'gpt-4o' }, new MockProvider());

// Add rate limiting (60 requests/minute)
engine.use(createRateLimiter({ maxRequests: 60, windowMs: 60000, strategy: 'token-bucket' }));

// Add content filtering
engine.use(createContentFilter({ useDefaults: true, blockSeverity: 'high' }));

// Add logging
engine.use(createLogger({ level: 'info' }));
```

### With Personas

```typescript
import {
  ChatEngine,
  MockProvider,
  createSystemPromptPlugin,
  BUILT_IN_PERSONAS,
} from '@dcyfr/ai-chatbot';

const engine = new ChatEngine({ model: 'gpt-4o' }, new MockProvider());

engine.registerPlugin(
  createSystemPromptPlugin({
    defaultPersona: BUILT_IN_PERSONAS.technical,
    variables: {
      date: () => new Date().toISOString(),
      version: '1.0.0',
    },
  })
);
```

### With Function Calling

```typescript
import {
  ChatEngine,
  MockProvider,
  createFunctionCallingPlugin,
  defineTool,
} from '@dcyfr/ai-chatbot';

const engine = new ChatEngine({ model: 'gpt-4o' }, new MockProvider());

engine.registerPlugin(
  createFunctionCallingPlugin({
    tools: [
      defineTool('get_weather', 'Get current weather', {
        type: 'object',
        properties: { city: { type: 'string' } },
      }, async (args) => ({ temp: 72, city: args.city })),
    ],
    autoExecute: true,
  })
);
```

## Architecture

```
src/
├── chat/           # Core chat engine, conversation manager, message handling
├── memory/         # Memory strategies (in-memory, sliding window, summary)
├── streaming/      # SSE streaming, token streamer, transformers
├── middleware/      # Pipeline, rate limiter, content filter, logger
├── providers/      # LLM providers (OpenAI, mock)
├── plugins/        # Plugin manager, system prompts, function calling
└── types/          # Zod schemas and TypeScript types
```

### Module Overview

| Module | Purpose |
|--------|---------|
| `chat/engine` | Core `ChatEngine` class — orchestrates the full lifecycle |
| `chat/conversation` | `ConversationManager` — CRUD for conversation threads |
| `chat/message` | Message creation, token estimation, truncation |
| `memory/in-memory` | Simple Map-based storage (no eviction) |
| `memory/sliding-window` | Keeps last N messages within token budget |
| `memory/summary` | Summarizes old messages, keeps recent in full |
| `streaming/stream-handler` | SSE formatting, `StreamCollector`, `StreamHandler` |
| `streaming/token-streamer` | Buffered token emission with word boundaries |
| `middleware/pipeline` | Composable middleware with priorities |
| `middleware/rate-limiter` | Token bucket rate limiting |
| `middleware/content-filter` | PII, injection, and content safety detection |
| `middleware/logger` | Structured logging with `LogStore` for testing |
| `providers/mock` | Deterministic responses for testing |
| `providers/openai` | OpenAI-compatible API provider |
| `plugins/plugin-manager` | Plugin lifecycle management |
| `plugins/system-prompt` | Dynamic prompts with personas |
| `plugins/function-calling` | Tool registration and execution |

## Content Filter Rules

| Rule | Type | Severity | Description |
|------|------|----------|-------------|
| `email-pii` | PII | Medium | Email address detection |
| `phone-pii` | PII | Medium | Phone number detection |
| `ssn-pii` | PII | Critical | SSN pattern detection |
| `credit-card-pii` | PII | Critical | Credit card number detection |
| `prompt-injection` | Injection | High | "Ignore previous instructions" patterns |
| `system-prompt-extraction` | Injection | High | System prompt extraction attempts |

## Built-in Personas

| Persona | Temperature | Description |
|---------|-------------|-------------|
| `helpful` | 0.7 | Friendly, clear, and honest |
| `technical` | 0.3 | Precise, code-focused, thorough |
| `creative` | 1.0 | Imaginative, expressive, unconventional |
| `concise` | 0.5 | Brief, direct, bullet-pointed |

## Development

```bash
# Run tests
npm run test:run

# Watch mode
npm test

# Type checking
npm run type-check

# Coverage
npm run test:coverage
```

## Compatibility

| Dependency | Version |
|-----------|---------|
| Node.js | ≥20.0.0 |
| TypeScript | ~5.7 |
| Zod | ^3.23 |

## License

MIT © DCYFR 2026
