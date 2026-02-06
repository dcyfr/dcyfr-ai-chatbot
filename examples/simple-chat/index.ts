/**
 * Simple Chat Example
 *
 * Demonstrates basic chat functionality with the mock provider.
 * Run with: npx tsx examples/simple-chat/index.ts
 */

import { ChatEngine, MockProvider } from '../../src/index.js';

async function main() {
  // Create a mock provider with custom responses
  const provider = new MockProvider({
    defaultResponse: "I'm a helpful assistant! How can I help you today?",
    responses: new Map([
      ['hello', 'Hi there! Welcome to the DCYFR chatbot. How can I assist you?'],
      ['weather', 'I cannot check the weather, but you can try weather.com!'],
      ['bye', 'Goodbye! Have a great day!'],
    ]),
  });

  // Create the chat engine
  const engine = new ChatEngine(
    {
      systemPrompt: 'You are a friendly AI assistant.',
      model: 'mock-model',
      temperature: 0.7,
    },
    provider
  );

  console.log('=== Simple Chat Example ===\n');

  // First message
  const response1 = await engine.chat({ message: 'Hello!' });
  console.log(`User: Hello!`);
  console.log(`Bot: ${response1.message.content}\n`);

  // Continue the conversation (same conversation ID)
  const response2 = await engine.chat({
    message: "What's the weather like?",
    conversationId: response1.conversationId,
  });
  console.log(`User: What's the weather like?`);
  console.log(`Bot: ${response2.message.content}\n`);

  // Third message
  const response3 = await engine.chat({
    message: 'Bye!',
    conversationId: response1.conversationId,
  });
  console.log(`User: Bye!`);
  console.log(`Bot: ${response3.message.content}\n`);

  // Show conversation stats
  const conversation = engine.conversations.get(response1.conversationId);
  console.log('--- Conversation Stats ---');
  console.log(`Messages: ${conversation?.metadata.messageCount}`);
  console.log(`Tokens: ${conversation?.metadata.totalTokens}`);

  await engine.destroy();
}

main().catch(console.error);
