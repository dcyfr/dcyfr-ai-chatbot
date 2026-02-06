/**
 * Rate Limiter tests
 */

import { describe, it, expect } from 'vitest';
import { createRateLimiter } from '../../../src/middleware/rate-limiter.js';
import type { MiddlewareContext } from '../../../src/types/index.js';
import { ChatConfigSchema } from '../../../src/types/index.js';

function createContext(conversationId = 'conv-1'): MiddlewareContext {
  return {
    request: { message: 'Hello', role: 'user', stream: false },
    conversation: {
      id: conversationId,
      messages: [],
      metadata: { totalTokens: 0, messageCount: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    config: ChatConfigSchema.parse({}),
    metadata: {},
  };
}

describe('createRateLimiter', () => {
  it('should allow requests within limit', async () => {
    const limiter = createRateLimiter({
      maxRequests: 5,
      windowMs: 60000,
      strategy: 'token-bucket',
    });

    const result = await limiter.execute(
      createContext(),
      async () => ({ proceed: true, context: createContext() })
    );
    expect(result.proceed).toBe(true);
  });

  it('should block requests exceeding limit', async () => {
    const limiter = createRateLimiter({
      maxRequests: 2,
      windowMs: 60000,
      strategy: 'token-bucket',
    });

    const ctx = createContext('rate-test');
    const next = async () => ({ proceed: true, context: ctx });

    // First two should pass
    const r1 = await limiter.execute(ctx, next);
    const r2 = await limiter.execute(ctx, next);
    expect(r1.proceed).toBe(true);
    expect(r2.proceed).toBe(true);

    // Third should be blocked
    const r3 = await limiter.execute(ctx, next);
    expect(r3.proceed).toBe(false);
    expect(r3.error).toContain('Rate limit exceeded');
  });

  it('should track remaining tokens', async () => {
    const limiter = createRateLimiter({
      maxRequests: 5,
      windowMs: 60000,
      strategy: 'token-bucket',
    });

    const ctx = createContext('track-test');
    await limiter.execute(ctx, async () => ({ proceed: true, context: ctx }));
    expect(ctx.metadata['rateLimitRemaining']).toBeDefined();
  });

  it('should have correct metadata', () => {
    const limiter = createRateLimiter({
      maxRequests: 10,
      windowMs: 60000,
      strategy: 'token-bucket',
    });
    expect(limiter.name).toBe('rate-limiter');
    expect(limiter.priority).toBe(-100);
  });

  it('should isolate by conversation', async () => {
    const limiter = createRateLimiter({
      maxRequests: 1,
      windowMs: 60000,
      strategy: 'token-bucket',
    });

    const ctx1 = createContext('conv-a');
    const ctx2 = createContext('conv-b');
    const next = async () => ({ proceed: true, context: ctx1 });

    // Both should pass (different conversations)
    const r1 = await limiter.execute(ctx1, next);
    const r2 = await limiter.execute(ctx2, async () => ({ proceed: true, context: ctx2 }));
    expect(r1.proceed).toBe(true);
    expect(r2.proceed).toBe(true);

    // Same conversation should now be blocked
    const r3 = await limiter.execute(ctx1, next);
    expect(r3.proceed).toBe(false);
  });
});
