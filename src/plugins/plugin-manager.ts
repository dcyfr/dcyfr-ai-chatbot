/**
 * Plugin Manager - Plugin lifecycle management
 *
 * Manages registration, initialization, and cleanup of chat plugins.
 * Plugins extend the chat engine with additional capabilities.
 */

import type { ChatConfig, ChatResponse, MiddlewareContext, Plugin } from '../types/index.js';

/**
 * Manages plugin lifecycle and execution
 */
export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private initialized = false;

  /**
   * Register a plugin
   */
  register(plugin: Plugin): this {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin already registered: ${plugin.name}`);
    }
    this.plugins.set(plugin.name, plugin);
    return this;
  }

  /**
   * Unregister a plugin
   */
  unregister(name: string): boolean {
    return this.plugins.delete(name);
  }

  /**
   * Get a plugin by name
   */
  get(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Check if a plugin is registered
   */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Initialize all plugins
   */
  async init(config: ChatConfig): Promise<void> {
    if (this.initialized) return;

    for (const plugin of this.plugins.values()) {
      if (plugin.hooks.onInit) {
        await plugin.hooks.onInit(config);
      }
    }
    this.initialized = true;
  }

  /**
   * Run all beforeChat hooks
   */
  async beforeChat(context: MiddlewareContext): Promise<MiddlewareContext> {
    let currentContext = context;
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks.onBeforeChat) {
        currentContext = await plugin.hooks.onBeforeChat(currentContext);
      }
    }
    return currentContext;
  }

  /**
   * Run all afterChat hooks
   */
  async afterChat(
    response: ChatResponse,
    context: MiddlewareContext
  ): Promise<ChatResponse> {
    let currentResponse = response;
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks.onAfterChat) {
        currentResponse = await plugin.hooks.onAfterChat(currentResponse, context);
      }
    }
    return currentResponse;
  }

  /**
   * Run all error hooks
   */
  async onError(error: Error, context: MiddlewareContext): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks.onError) {
        await plugin.hooks.onError(error, context);
      }
    }
  }

  /**
   * Destroy all plugins
   */
  async destroy(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks.onDestroy) {
        await plugin.hooks.onDestroy();
      }
    }
    this.plugins.clear();
    this.initialized = false;
  }

  /**
   * Get all registered plugin names
   */
  names(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Get the number of registered plugins
   */
  get size(): number {
    return this.plugins.size;
  }
}
