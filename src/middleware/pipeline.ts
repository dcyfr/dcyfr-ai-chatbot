/**
 * Middleware Pipeline - Composable middleware execution
 *
 * Middleware runs before/after chat requests, enabling cross-cutting
 * concerns like rate limiting, content filtering, and logging.
 */

import type { Middleware, MiddlewareContext, MiddlewareFn, MiddlewareResult } from '../types/index.js';

/**
 * Create a named middleware from a function
 */
export function createMiddleware(
  name: string,
  execute: MiddlewareFn,
  options?: { description?: string; priority?: number }
): Middleware {
  return {
    name,
    description: options?.description,
    priority: options?.priority ?? 0,
    execute,
  };
}

/**
 * Compose multiple middleware functions into a single pipeline
 */
export function composeMiddleware(middlewares: Middleware[]): MiddlewareFn {
  // Sort by priority (lower = earlier)
  const sorted = [...middlewares].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

  return async (
    context: MiddlewareContext,
    _next: () => Promise<MiddlewareResult>
  ): Promise<MiddlewareResult> => {
    let currentIndex = 0;
    let currentContext = context;

    const next = async (): Promise<MiddlewareResult> => {
      if (currentIndex >= sorted.length) {
        return { proceed: true, context: currentContext };
      }

      const middleware = sorted[currentIndex++];
      const result = await middleware.execute(currentContext, next);
      if (result.proceed) {
        currentContext = result.context;
      }
      return result;
    };

    return next();
  };
}

/**
 * Middleware pipeline with named middleware management
 */
export class MiddlewarePipeline {
  private middlewares: Map<string, Middleware> = new Map();

  /**
   * Add a middleware to the pipeline
   */
  use(middleware: Middleware): this {
    this.middlewares.set(middleware.name, middleware);
    return this;
  }

  /**
   * Remove a middleware by name
   */
  remove(name: string): boolean {
    return this.middlewares.delete(name);
  }

  /**
   * Get a middleware by name
   */
  get(name: string): Middleware | undefined {
    return this.middlewares.get(name);
  }

  /**
   * Check if a middleware exists
   */
  has(name: string): boolean {
    return this.middlewares.has(name);
  }

  /**
   * Execute the full pipeline
   */
  async execute(context: MiddlewareContext): Promise<MiddlewareResult> {
    const middlewareArray = Array.from(this.middlewares.values());

    if (middlewareArray.length === 0) {
      return { proceed: true, context };
    }

    const composed = composeMiddleware(middlewareArray);
    return composed(
      context,
      async () => ({ proceed: true, context })
    );
  }

  /**
   * Get the number of middlewares
   */
  get size(): number {
    return this.middlewares.size;
  }

  /**
   * Get all middleware names
   */
  names(): string[] {
    return Array.from(this.middlewares.keys());
  }

  /**
   * Clear all middlewares
   */
  clear(): void {
    this.middlewares.clear();
  }
}
