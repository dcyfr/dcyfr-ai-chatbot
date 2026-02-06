/**
 * System Prompt Plugin tests
 */

import { describe, it, expect } from 'vitest';
import {
  createSystemPromptPlugin,
  BUILT_IN_PERSONAS,
} from '../../../src/plugins/system-prompt.js';
import type { MiddlewareContext, ChatConfig } from '../../../src/types/index.js';
import { ChatConfigSchema } from '../../../src/types/index.js';

function createContext(systemPrompt = 'You are a helpful AI assistant.'): MiddlewareContext {
  return {
    request: { message: 'Hello', role: 'user', stream: false },
    conversation: {
      id: 'conv-1',
      messages: [],
      metadata: { totalTokens: 0, messageCount: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    config: ChatConfigSchema.parse({ systemPrompt }),
    metadata: {},
  };
}

describe('BUILT_IN_PERSONAS', () => {
  it('should have helpful persona', () => {
    expect(BUILT_IN_PERSONAS.helpful).toBeDefined();
    expect(BUILT_IN_PERSONAS.helpful.name).toBe('helpful');
    expect(BUILT_IN_PERSONAS.helpful.temperature).toBe(0.7);
  });

  it('should have technical persona', () => {
    expect(BUILT_IN_PERSONAS.technical).toBeDefined();
    expect(BUILT_IN_PERSONAS.technical.temperature).toBe(0.3);
  });

  it('should have creative persona', () => {
    expect(BUILT_IN_PERSONAS.creative).toBeDefined();
    expect(BUILT_IN_PERSONAS.creative.temperature).toBe(1.0);
  });

  it('should have concise persona', () => {
    expect(BUILT_IN_PERSONAS.concise).toBeDefined();
    expect(BUILT_IN_PERSONAS.concise.temperature).toBe(0.5);
  });
});

describe('createSystemPromptPlugin', () => {
  it('should set system prompt metadata on conversation', async () => {
    const plugin = createSystemPromptPlugin({
      defaultPersona: BUILT_IN_PERSONAS.helpful,
    });

    const ctx = createContext();
    const result = await plugin.hooks.onBeforeChat!(ctx);
    expect(result.conversation.metadata.systemPrompt).toBe(
      BUILT_IN_PERSONAS.helpful.systemPrompt
    );
  });

  it('should fall back to config systemPrompt when no persona', async () => {
    const plugin = createSystemPromptPlugin({});
    const ctx = createContext('Custom system prompt.');
    const result = await plugin.hooks.onBeforeChat!(ctx);
    expect(result.conversation.metadata.systemPrompt).toBe('Custom system prompt.');
  });

  it('should apply persona and set activePersona metadata', async () => {
    const plugin = createSystemPromptPlugin({
      defaultPersona: BUILT_IN_PERSONAS.technical,
    });

    const ctx = createContext();
    const result = await plugin.hooks.onBeforeChat!(ctx);
    expect(result.conversation.metadata.systemPrompt).toContain(
      BUILT_IN_PERSONAS.technical.systemPrompt
    );
    expect(result.metadata['activePersona']).toBe('technical');
  });

  it('should inject variables into prompt', async () => {
    const plugin = createSystemPromptPlugin({
      variables: { name: 'Ada', role: 'programmer' },
    });

    const ctx = createContext('You are {{name}}, a {{role}}.');
    const result = await plugin.hooks.onBeforeChat!(ctx);
    expect(result.conversation.metadata.systemPrompt).toBe(
      'You are Ada, a programmer.'
    );
  });

  it('should add prefix and suffix', async () => {
    const plugin = createSystemPromptPlugin({
      prefix: 'PREFIX:',
      suffix: 'SUFFIX.',
    });

    const ctx = createContext('Core instruction.');
    const result = await plugin.hooks.onBeforeChat!(ctx);
    expect(result.conversation.metadata.systemPrompt).toContain('PREFIX:');
    expect(result.conversation.metadata.systemPrompt).toContain('Core instruction.');
    expect(result.conversation.metadata.systemPrompt).toContain('SUFFIX.');
  });

  it('should have correct plugin metadata', () => {
    const plugin = createSystemPromptPlugin();
    expect(plugin.name).toBe('system-prompt');
    expect(plugin.version).toBe('1.0.0');
  });

  it('should use default config prompt when no persona and no override', async () => {
    const plugin = createSystemPromptPlugin();
    const ctx = createContext();
    const result = await plugin.hooks.onBeforeChat!(ctx);
    // Falls back to config systemPrompt
    expect(result.conversation.metadata.systemPrompt).toBeDefined();
  });
});
