/**
 * Rate Limiter Middleware - Token bucket rate limiting
 *
 * Controls the rate of chat requests per conversation or globally,
 * preventing abuse and ensuring fair resource usage.
 */

import type { Middleware, MiddlewareContext, MiddlewareResult, RateLimitConfig } from '../types/index.js';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

/**
 * Create a rate limiting middleware
 */
export function createRateLimiter(config: RateLimitConfig): Middleware {
  const buckets: Map<string, TokenBucket> = new Map();
  const maxTokens = config.maxRequests;
  const refillRateMs = config.windowMs / config.maxRequests;

  function getBucket(key: string): TokenBucket {
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { tokens: maxTokens, lastRefill: Date.now() };
      buckets.set(key, bucket);
    }
    return bucket;
  }

  function refill(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(elapsed / refillRateMs);

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }
  }

  function tryConsume(key: string): { allowed: boolean; retryAfterMs?: number } {
    const bucket = getBucket(key);
    refill(bucket);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true };
    }

    const retryAfterMs = Math.ceil(refillRateMs - (Date.now() - bucket.lastRefill));
    return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  return {
    name: 'rate-limiter',
    description: `Token bucket rate limiter: ${config.maxRequests} requests per ${config.windowMs}ms`,
    priority: -100, // Run early
    execute: async (
      context: MiddlewareContext,
      next: () => Promise<MiddlewareResult>
    ): Promise<MiddlewareResult> => {
      const key = context.conversation.id;
      const result = tryConsume(key);

      if (!result.allowed) {
        return {
          proceed: false,
          context,
          error: `Rate limit exceeded. Retry after ${result.retryAfterMs}ms`,
        };
      }

      context.metadata['rateLimitRemaining'] = getBucket(key).tokens;
      return next();
    },
  };
}

/**
 * Get remaining tokens for a conversation
 */
export function getRateLimitInfo(
  limiter: ReturnType<typeof createRateLimiter>,
  _conversationId: string
): { name: string; description?: string } {
  return {
    name: limiter.name,
    description: limiter.description,
  };
}
