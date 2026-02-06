/**
 * PluginManager tests
 */

import { describe, it, expect, vi } from 'vitest';
import { PluginManager } from '../../../src/plugins/plugin-manager.js';
import type { Plugin, ChatConfig, MiddlewareContext, ChatResponse } from '../../../src/types/index.js';
import { ChatConfigSchema } from '../../../src/types/index.js';

function createPlugin(name: string, overrides: Partial<Plugin> = {}): Plugin {
  return {
    name,
    version: '1.0.0',
    hooks: {
      onInit: vi.fn(),
      onBeforeChat: vi.fn(async (ctx: MiddlewareContext) => ctx),
      onAfterChat: vi.fn(async (resp: ChatResponse, _ctx: MiddlewareContext) => resp),
      onError: vi.fn(),
      onDestroy: vi.fn(),
    },
    ...overrides,
  };
}

function createMockConfig(): ChatConfig {
  return ChatConfigSchema.parse({});
}

function createMockContext(): MiddlewareContext {
  return {
    request: { message: 'Hello', role: 'user', stream: false },
    conversation: {
      id: 'conv-1',
      messages: [],
      metadata: { totalTokens: 0, messageCount: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    config: createMockConfig(),
    metadata: {},
  };
}

function createMockResponse(): ChatResponse {
  return {
    message: {
      id: 'msg-1',
      role: 'assistant',
      content: 'Hello',
      metadata: { timestamp: Date.now() },
    },
    conversationId: 'conv-1',
    finishReason: 'stop',
  };
}

describe('PluginManager', () => {
  it('should register a plugin', () => {
    const manager = new PluginManager();
    const plugin = createPlugin('test');
    manager.register(plugin);
    expect(manager.has('test')).toBe(true);
  });

  it('should unregister a plugin', () => {
    const manager = new PluginManager();
    const plugin = createPlugin('test');
    manager.register(plugin);
    manager.unregister('test');
    expect(manager.has('test')).toBe(false);
  });

  it('should get registered plugin', () => {
    const manager = new PluginManager();
    const plugin = createPlugin('test');
    manager.register(plugin);
    expect(manager.get('test')).toBe(plugin);
  });

  it('should list all plugin names', () => {
    const manager = new PluginManager();
    manager.register(createPlugin('alpha'));
    manager.register(createPlugin('beta'));
    expect(manager.names()).toEqual(['alpha', 'beta']);
  });

  it('should initialize all plugins', async () => {
    const manager = new PluginManager();
    const plugin = createPlugin('test');
    manager.register(plugin);

    await manager.init(createMockConfig());
    expect(plugin.hooks.onInit).toHaveBeenCalled();
  });

  it('should call beforeChat hooks', async () => {
    const manager = new PluginManager();
    const plugin = createPlugin('test');
    manager.register(plugin);
    await manager.init(createMockConfig());

    const ctx = createMockContext();
    await manager.beforeChat(ctx);
    expect(plugin.hooks.onBeforeChat).toHaveBeenCalledWith(ctx);
  });

  it('should call afterChat hooks', async () => {
    const manager = new PluginManager();
    const plugin = createPlugin('test');
    manager.register(plugin);
    await manager.init(createMockConfig());

    const resp = createMockResponse();
    const ctx = createMockContext();
    await manager.afterChat(resp, ctx);
    expect(plugin.hooks.onAfterChat).toHaveBeenCalledWith(resp, ctx);
  });

  it('should call onError hooks', async () => {
    const manager = new PluginManager();
    const plugin = createPlugin('test');
    manager.register(plugin);
    await manager.init(createMockConfig());

    const error = new Error('test error');
    const ctx = createMockContext();
    await manager.onError(error, ctx);
    expect(plugin.hooks.onError).toHaveBeenCalledWith(error, ctx);
  });

  it('should destroy all plugins', async () => {
    const manager = new PluginManager();
    const plugin = createPlugin('test');
    manager.register(plugin);
    await manager.init(createMockConfig());

    await manager.destroy();
    expect(plugin.hooks.onDestroy).toHaveBeenCalled();
  });

  it('should throw on duplicate registration', () => {
    const manager = new PluginManager();
    const plugin1 = createPlugin('test');
    const plugin2 = createPlugin('test');
    manager.register(plugin1);

    expect(() => manager.register(plugin2)).toThrow('Plugin already registered: test');
  });

  it('should handle plugins with partial hooks', async () => {
    const manager = new PluginManager();
    const plugin: Plugin = {
      name: 'minimal',
      version: '1.0.0',
      hooks: {},
    };
    manager.register(plugin);
    await manager.init(createMockConfig());

    const ctx = createMockContext();
    const resp = createMockResponse();

    // Should not throw
    await manager.beforeChat(ctx);
    await manager.afterChat(resp, ctx);
    await manager.onError(new Error(), ctx);
    await manager.destroy();
  });

  it('should return size', () => {
    const manager = new PluginManager();
    expect(manager.size).toBe(0);
    manager.register(createPlugin('a'));
    expect(manager.size).toBe(1);
    manager.register(createPlugin('b'));
    expect(manager.size).toBe(2);
  });
});
