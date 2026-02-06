/**
 * Function Calling Plugin tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createFunctionCallingPlugin,
  defineTool,
} from '../../../src/plugins/function-calling.js';
import { createMessage } from '../../../src/chat/message.js';
import type { ChatResponse, MiddlewareContext } from '../../../src/types/index.js';
import { ChatConfigSchema } from '../../../src/types/index.js';

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
    config: ChatConfigSchema.parse({}),
    metadata: {},
  };
}

function createMockResponse(
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>
): ChatResponse {
  return {
    message: {
      id: 'msg-1',
      role: 'assistant',
      content: '',
      metadata: { timestamp: Date.now() },
    },
    conversationId: 'conv-1',
    toolCalls,
    finishReason: toolCalls ? 'tool_calls' : 'stop',
  };
}

describe('defineTool', () => {
  it('should create a tool definition with positional args', () => {
    const tool = defineTool(
      'get_weather',
      'Get the weather for a location',
      { location: 'string' },
      async (params) => ({ temperature: 72, location: params['location'] })
    );

    expect(tool.name).toBe('get_weather');
    expect(tool.description).toBe('Get the weather for a location');
    expect(tool.execute).toBeDefined();
  });

  it('should execute tool function', async () => {
    const tool = defineTool(
      'add',
      'Add two numbers',
      { a: 'number', b: 'number' },
      async (params) => ({ result: (params['a'] as number) + (params['b'] as number) })
    );

    const result = await tool.execute!({ a: 1, b: 2 });
    expect(result).toEqual({ result: 3 });
  });

  it('should create tool without execute', () => {
    const tool = defineTool('lookup', 'Lookup something', { query: 'string' });

    expect(tool.name).toBe('lookup');
    expect(tool.execute).toBeUndefined();
  });
});

describe('createFunctionCallingPlugin', () => {
  it('should create plugin with correct metadata', () => {
    const plugin = createFunctionCallingPlugin({ tools: [] });
    expect(plugin.name).toBe('function-calling');
    expect(plugin.version).toBe('1.0.0');
  });

  it('should inject tool metadata via onBeforeChat', async () => {
    const plugin = createFunctionCallingPlugin({
      tools: [
        defineTool('tool_a', 'Tool A', {}),
        defineTool('tool_b', 'Tool B', {}),
      ],
    });

    const ctx = createMockContext();
    const result = await plugin.hooks.onBeforeChat!(ctx);
    expect(result.metadata['availableTools']).toEqual(['tool_a', 'tool_b']);
  });

  it('should auto-execute tools via onAfterChat', async () => {
    const handler = vi.fn().mockResolvedValue({ result: 'done' });

    const plugin = createFunctionCallingPlugin({
      tools: [
        defineTool('my_tool', 'My tool', { input: 'string' }, handler),
      ],
      autoExecute: true,
    });

    const resp = createMockResponse([
      { id: 'call-1', name: 'my_tool', arguments: { input: 'test' } },
    ]);
    const ctx = createMockContext();

    await plugin.hooks.onAfterChat!(resp, ctx);
    expect(handler).toHaveBeenCalledWith({ input: 'test' });
  });

  it('should respect maxToolCallsPerTurn', async () => {
    const handler = vi.fn().mockResolvedValue({ result: 'ok' });

    const plugin = createFunctionCallingPlugin({
      tools: [
        defineTool('my_tool', 'My tool', {}, handler),
      ],
      autoExecute: true,
      maxToolCallsPerTurn: 1,
    });

    const resp = createMockResponse([
      { id: 'call-1', name: 'my_tool', arguments: {} },
      { id: 'call-2', name: 'my_tool', arguments: {} },
    ]);
    const ctx = createMockContext();

    await plugin.hooks.onAfterChat!(resp, ctx);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should not auto-execute when disabled', async () => {
    const handler = vi.fn();

    const plugin = createFunctionCallingPlugin({
      tools: [
        defineTool('my_tool', 'My tool', {}, handler),
      ],
      autoExecute: false,
    });

    const resp = createMockResponse([
      { id: 'call-1', name: 'my_tool', arguments: {} },
    ]);
    const ctx = createMockContext();

    await plugin.hooks.onAfterChat!(resp, ctx);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should pass through when no tool calls in response', async () => {
    const plugin = createFunctionCallingPlugin({
      tools: [
        defineTool('my_tool', 'My tool', {}),
      ],
    });

    const resp = createMockResponse(); // no tool calls
    const ctx = createMockContext();
    const result = await plugin.hooks.onAfterChat!(resp, ctx);
    expect(result).toBeDefined();
  });
});
