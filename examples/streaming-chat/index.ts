/**
 * Streaming Chat Example
 *
 * Demonstrates streaming responses with token-by-token output.
 * Run with: npx tsx examples/streaming-chat/index.ts
 */

import {
  ChatEngine,
  MockProvider,
  StreamCollector,
  createStreamChunk,
} from '../../src/index.js';

async function main() {
  const provider = new MockProvider({
    defaultResponse:
      'Streaming is a technique where the response is sent token by token ' +
      'instead of waiting for the complete response. This provides a better ' +
      'user experience because the user can see the response being generated ' +
      'in real time.',
    streamDelayMs: 10, // Simulate token-by-token delay
  });

  const engine = new ChatEngine(
    {
      systemPrompt: 'You are a technical AI assistant.',
      model: 'mock-model',
    },
    provider
  );

  console.log('=== Streaming Chat Example ===\n');
  console.log('User: What is streaming?');
  process.stdout.write('Bot: ');

  // Use StreamCollector to accumulate the full response
  const collector = new StreamCollector();

  for await (const chunk of engine.stream({
    message: 'What is streaming?',
    stream: true,
  })) {
    collector.add(chunk);

    if (chunk.type === 'token' && typeof chunk.data === 'string') {
      process.stdout.write(chunk.data);
    }

    if (chunk.type === 'done') {
      console.log('\n');
      console.log('--- Stream Stats ---');
      console.log(`Chunks received: ${collector.count}`);
      console.log(`Total content length: ${collector.getContent().length}`);
      console.log(`Stream complete: ${collector.done}`);
    }
  }

  await engine.destroy();
}

main().catch(console.error);
