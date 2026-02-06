/**
 * Middleware Pipeline tests
 */

import { describe, it, expect } from 'vitest';
import {
  createMiddleware,
  composeMiddleware,
  MiddlewarePipeline,
} from '../../../src/middleware/pipeline.js';
import { createMessage } from '../../../src/chat/message.js';
import type { MiddlewareContext } from '../../../src/types/index.js';
import { ChatConfigSchema } from '../../../src/types/index.js';

function createContext(message = 'Hello'): MiddlewareContext {
  return {
    request: { message, role: 'user', stream: false },
    conversation: {
      id: 'conv-1',
      messages: [],
      metadata: { totalTokens: 0, messageCount: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    config: ChatConfigSchema.parse({}),
    metadata: {},
  };
}

describe('createMiddleware', () => {
  it('should create a named middleware', () => {
    const mw = createMiddleware('test', async (ctx, next) => next());
    expect(mw.name).toBe('test');
    expect(mw.priority).toBe(0);
  });

  it('should accept priority', () => {
    const mw = createMiddleware('test', async (ctx, next) => next(), { priority: 10 });
    expect(mw.priority).toBe(10);
  });
});

describe('composeMiddleware', () => {
  it('should compose multiple middlewares', async () => {
    const order: string[] = [];

    const mw1 = createMiddleware('first', async (ctx, next) => {
      order.push('first');
      return next();
    }, { priority: 1 });

    const mw2 = createMiddleware('second', async (ctx, next) => {
      order.push('second');
      return next();
    }, { priority: 2 });

    const composed = composeMiddleware([mw2, mw1]); // pass in reverse
    const result = await composed(
      createContext(),
      async () => ({ proceed: true, context: createContext() })
    );

    expect(order).toEqual(['first', 'second']); // sorted by priority
    expect(result.proceed).toBe(true);
  });

  it('should stop at blocking middleware', async () => {
    const mw1 = createMiddleware('blocker', async (ctx, _next) => ({
      proceed: false,
      context: ctx,
      error: 'Blocked',
    }));

    const mw2 = createMiddleware('after', async (ctx, next) => next());

    const composed = composeMiddleware([mw1, mw2]);
    const result = await composed(
      createContext(),
      async () => ({ proceed: true, context: createContext() })
    );

    expect(result.proceed).toBe(false);
    expect(result.error).toBe('Blocked');
  });
});

describe('MiddlewarePipeline', () => {
  it('should add and execute middlewares', async () => {
    const pipeline = new MiddlewarePipeline();
    let called = false;

    pipeline.use(
      createMiddleware('test', async (ctx, next) => {
        called = true;
        return next();
      })
    );

    const result = await pipeline.execute(createContext());
    expect(called).toBe(true);
    expect(result.proceed).toBe(true);
  });

  it('should remove middleware', () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createMiddleware('test', async (ctx, next) => next()));
    expect(pipeline.has('test')).toBe(true);
    pipeline.remove('test');
    expect(pipeline.has('test')).toBe(false);
  });

  it('should get middleware by name', () => {
    const pipeline = new MiddlewarePipeline();
    const mw = createMiddleware('test', async (ctx, next) => next());
    pipeline.use(mw);
    expect(pipeline.get('test')).toBe(mw);
  });

  it('should return size', () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createMiddleware('a', async (ctx, next) => next()));
    pipeline.use(createMiddleware('b', async (ctx, next) => next()));
    expect(pipeline.size).toBe(2);
  });

  it('should list names', () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createMiddleware('alpha', async (ctx, next) => next()));
    pipeline.use(createMiddleware('beta', async (ctx, next) => next()));
    expect(pipeline.names()).toEqual(['alpha', 'beta']);
  });

  it('should clear all', () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createMiddleware('test', async (ctx, next) => next()));
    pipeline.clear();
    expect(pipeline.size).toBe(0);
  });

  it('should proceed when empty', async () => {
    const pipeline = new MiddlewarePipeline();
    const result = await pipeline.execute(createContext());
    expect(result.proceed).toBe(true);
  });
});
