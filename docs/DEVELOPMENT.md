# Development Guide

## Architecture Overview

The chatbot framework is organized in layers:

```
Request → Middleware → Engine → Provider → Response
                        ↕
                    Memory Store
                        ↕
                     Plugins
```

## Module Dependency Graph

```
types/  ←── All modules depend on types
  ↑
chat/   ←── Core engine, message handling, conversations
  ↑
memory/ ←── Memory strategies use chat/message utilities
  ↑
streaming/ ←── Stream handling, token buffering
  ↑
middleware/ ←── Pipeline, rate limiter, content filter, logger
  ↑
providers/ ←── LLM provider implementations
  ↑
plugins/ ←── Plugin lifecycle, personas, function calling
  ↑
index.ts ←── Barrel exports everything
```

## Running Locally

```bash
# Install
npm install

# Development (watch mode)
npm run dev

# Tests
npm run test:run

# Type checking
npm run type-check

# Coverage
npm run test:coverage
```

## Creating a Custom Provider

```typescript
import type { ChatProvider, ProviderRequest, ProviderResponse, StreamChunk } from '@dcyfr/ai-chatbot';

export class MyProvider implements ChatProvider {
  readonly name = 'my-provider';

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    // Call your LLM API here
  }

  async *stream(request: ProviderRequest): AsyncIterable<StreamChunk> {
    // Stream from your LLM API here
  }
}
```

## Creating Custom Middleware

```typescript
import { createMiddleware } from '@dcyfr/ai-chatbot';

const myMiddleware = createMiddleware(
  'my-middleware',
  async (context, next) => {
    // Before processing
    console.log('Request:', context.request.message);

    const result = await next();

    // After processing
    console.log('Allowed:', result.proceed);

    return result;
  },
  { priority: 0 }
);
```

## Testing Strategy

- **Unit tests**: Test each module in isolation with `MockProvider`
- **Integration tests**: Test full chat flow through engine
- Use `LogStore` for testing middleware logging
- Use `StreamCollector` for testing streaming output
