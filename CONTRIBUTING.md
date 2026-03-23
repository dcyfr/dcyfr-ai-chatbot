# Contributing to @dcyfr/ai-chatbot

## Licensing & Contributions

By contributing to `@dcyfr/ai-chatbot`, you agree that:

- Your contributions will be licensed under the project's MIT License
- You have the right to submit the contribution under this license
- You grant DCYFR Labs perpetual rights to use, modify, and distribute your contribution

### Trademark

Do not use "DCYFR" trademarks in ways that imply endorsement without permission. See [../TRADEMARK.md](../TRADEMARK.md) for usage guidelines.

**Questions?** Contact [licensing@dcyfr.ai](mailto:licensing@dcyfr.ai)

## Development Setup

```bash
npm install
npm run type-check
npm run test:run
```

## Guidelines

- All code must be TypeScript strict mode
- New features require tests (target 80%+ coverage)
- Use Zod schemas for all data validation
- Follow existing patterns for providers, middleware, and plugins
- Run `npm run type-check` before committing

## Adding Features

### New Provider

1. Create `src/providers/my-provider.ts`
2. Implement `ChatProvider` interface
3. Export from `src/providers/index.ts`
4. Add tests in `tests/unit/providers/`

### New Middleware

1. Create `src/middleware/my-middleware.ts`
2. Export factory function
3. Export from `src/middleware/index.ts`
4. Add tests

### New Plugin

1. Create `src/plugins/my-plugin.ts`
2. Implement `Plugin` interface
3. Export from `src/plugins/index.ts`
4. Add tests

## Code Style

- Functions over classes where possible
- Prefer composition over inheritance
- Use descriptive names
- Document public APIs with JSDoc
