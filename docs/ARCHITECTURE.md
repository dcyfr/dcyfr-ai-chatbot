<!-- TLP:CLEAR -->
# Architecture

## Design Principles

1. **Provider-agnostic** — Swap LLM providers without changing application code
2. **Composable** — Mix and match middleware, plugins, and memory strategies
3. **Stream-first** — Native streaming support throughout the pipeline
4. **Type-safe** — Zod schemas validate all boundaries
5. **Testable** — MockProvider enables deterministic testing

## Core Concepts

### ChatEngine

The central orchestrator. Receives chat requests, runs the middleware pipeline,
manages conversations, calls the LLM provider, and returns responses.

### Conversations

A conversation is a thread of messages with metadata. The `ConversationManager`
handles CRUD operations, message addition, and pagination.

### Memory

Memory strategies control how conversation history is managed:

- **InMemoryStorage**: No eviction, stores everything
- **SlidingWindowMemory**: Keeps the last N messages within a token budget
- **SummaryMemory**: Summarizes older messages, keeps recent ones in full

### Middleware

Middleware runs before chat requests reach the provider:

- **Rate Limiter**: Token bucket algorithm, per-conversation limiting
- **Content Filter**: PII detection, prompt injection prevention
- **Logger**: Structured logging with audit trail

### Plugins

Plugins hook into the chat lifecycle:

- **System Prompt Plugin**: Dynamic prompts, persona management
- **Function Calling Plugin**: Tool registration and auto-execution

### Providers

Providers handle LLM communication:

- **MockProvider**: Testing — configurable responses, simulated latency
- **OpenAIProvider**: Production — OpenAI-compatible API calls
