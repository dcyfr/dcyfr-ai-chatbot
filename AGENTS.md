# AGENTS.md - dcyfr-ai-chatbot

## Project Overview

Conversational AI chatbot template built on the DCYFR AI framework.

## Architecture

- **ChatEngine** is the central orchestrator
- **Providers** handle LLM communication (OpenAI, mock)
- **Middleware** pipeline runs before/after each request
- **Plugins** extend functionality (personas, function calling)
- **Memory** strategies manage conversation context

## Patterns

### Chat Flow
1. Request → Middleware pipeline → Provider → Response → Plugins → Return

### Memory Strategy Selection
- `in-memory` — Short conversations, testing
- `sliding-window` — Most production use cases
- `summary` — Very long conversations

### Adding a New Provider
1. Implement `ChatProvider` interface
2. Add to `src/providers/`
3. Export from `src/providers/index.ts`

### Adding Middleware
1. Use `createMiddleware()` helper or implement `Middleware` interface
2. Set priority (lower = runs first)
3. Call `next()` to continue pipeline

## Testing
- Uses Vitest with `MockProvider` for deterministic tests
- Unit tests in `tests/unit/`
- Integration tests in `tests/integration/`

## Tech Stack
- TypeScript ~5.7, strict mode
- Zod for schema validation
- Vitest for testing
- Node.js ≥20
