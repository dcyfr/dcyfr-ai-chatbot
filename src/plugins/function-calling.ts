/**
 * Function Calling Plugin - Tool/function calling support
 *
 * Enables the chat engine to use registered tools/functions during
 * conversations, handling the tool call lifecycle.
 */

import type { ChatResponse, MiddlewareContext, Plugin, ToolDefinition } from '../types/index.js';

export interface FunctionCallingOptions {
  /** Available tools */
  tools?: ToolDefinition[];
  /** Maximum tool calls per turn */
  maxToolCallsPerTurn?: number;
  /** Whether to auto-execute tool calls */
  autoExecute?: boolean;
  /** Timeout for tool execution (ms) */
  executionTimeoutMs?: number;
}

/**
 * Create a function calling plugin
 */
export function createFunctionCallingPlugin(options?: FunctionCallingOptions): Plugin {
  const tools = new Map<string, ToolDefinition>();
  const maxCalls = options?.maxToolCallsPerTurn ?? 5;
  const autoExecute = options?.autoExecute ?? true;

  // Register initial tools
  if (options?.tools) {
    for (const tool of options.tools) {
      tools.set(tool.name, tool);
    }
  }

  return {
    name: 'function-calling',
    version: '1.0.0',
    description: 'Tool/function calling support for conversational AI',
    hooks: {
      onBeforeChat: async (context: MiddlewareContext): Promise<MiddlewareContext> => {
        // Inject available tools into the request options
        if (tools.size > 0) {
          const toolDefs = Array.from(tools.values());
          return {
            ...context,
            metadata: {
              ...context.metadata,
              availableTools: toolDefs.map((t) => t.name),
              maxToolCallsPerTurn: maxCalls,
            },
          };
        }
        return context;
      },

      onAfterChat: async (
        response: ChatResponse,
        _context: MiddlewareContext
      ): Promise<ChatResponse> => {
        // Process tool calls if auto-execute is enabled
        if (!autoExecute || !response.toolCalls || response.toolCalls.length === 0) {
          return response;
        }

        // Limit tool calls
        const callsToProcess = response.toolCalls.slice(0, maxCalls);
        const results: Array<{ toolName: string; result: unknown; error?: string }> = [];

        for (const toolCall of callsToProcess) {
          const tool = tools.get(toolCall.name);
          if (!tool || !tool.execute) {
            results.push({
              toolName: toolCall.name,
              result: null,
              error: `Tool not found: ${toolCall.name}`,
            });
            continue;
          }

          try {
            const result = await tool.execute(toolCall.arguments);
            results.push({ toolName: toolCall.name, result });
          } catch (error) {
            results.push({
              toolName: toolCall.name,
              result: null,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        return {
          ...response,
          message: {
            ...response.message,
            metadata: {
              ...response.message.metadata,
            },
          },
        };
      },
    },
  };
}

/**
 * Create a tool definition helper
 */
export function defineTool(
  name: string,
  description: string,
  parameters: Record<string, unknown>,
  execute?: (args: Record<string, unknown>) => Promise<unknown>
): ToolDefinition {
  return {
    name,
    description,
    parameters,
    execute,
  };
}
