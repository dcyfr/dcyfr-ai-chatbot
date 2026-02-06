/**
 * Advanced Chat Example
 *
 * Demonstrates middleware, plugins, personas, and function calling.
 * Run with: npx tsx examples/advanced-chat/index.ts
 */

import {
  ChatEngine,
  MockProvider,
  createRateLimiter,
  createContentFilter,
  createLogger,
  LogStore,
  createSystemPromptPlugin,
  BUILT_IN_PERSONAS,
  createFunctionCallingPlugin,
  defineTool,
} from '../../src/index.js';

async function main() {
  // Create provider with tool call support
  const provider = new MockProvider({
    defaultResponse: 'I can help you with that! Let me check...',
    responses: new Map([
      ['calculate', 'The result of the calculation is 42.'],
      ['time', 'The current time has been retrieved for you.'],
    ]),
  });

  // Create the chat engine
  const engine = new ChatEngine(
    {
      systemPrompt: 'You are a multi-capable AI assistant.',
      model: 'mock-model',
    },
    provider
  );

  // === Middleware ===

  // Rate limiting
  engine.use(
    createRateLimiter({
      maxRequests: 10,
      windowMs: 60000,
      strategy: 'token-bucket',
    })
  );

  // Content filtering
  engine.use(
    createContentFilter({
      useDefaults: true,
      blockSeverity: 'high',
    })
  );

  // Logging
  const logStore = new LogStore();
  engine.use(
    createLogger({
      level: 'info',
      handler: logStore.handler,
    })
  );

  // === Plugins ===

  // System prompt with personas
  engine.registerPlugin(
    createSystemPromptPlugin({
      defaultPersona: BUILT_IN_PERSONAS.technical,
      variables: {
        date: () => new Date().toISOString().split('T')[0],
        version: '1.0.0',
      },
    })
  );

  // Function calling
  engine.registerPlugin(
    createFunctionCallingPlugin({
      tools: [
        defineTool(
          'get_time',
          'Get the current time',
          { type: 'object', properties: {} },
          async () => ({ time: new Date().toISOString() })
        ),
        defineTool(
          'calculate',
          'Perform a calculation',
          {
            type: 'object',
            properties: {
              expression: { type: 'string' },
            },
          },
          async (args) => ({
            result: `Calculated: ${args['expression']}`,
          })
        ),
      ],
      autoExecute: true,
    })
  );

  console.log('=== Advanced Chat Example ===\n');

  // Chat with technical persona
  const response1 = await engine.chat({
    message: 'Can you calculate something for me?',
  });
  console.log('User: Can you calculate something for me?');
  console.log(`Bot: ${response1.message.content}\n`);

  // Show logs
  console.log('--- Log Entries ---');
  for (const entry of logStore.getEntries()) {
    console.log(`[${entry.level.toUpperCase()}] ${entry.event}`);
  }

  console.log(`\nTotal log entries: ${logStore.size}`);

  await engine.destroy();
}

main().catch(console.error);
