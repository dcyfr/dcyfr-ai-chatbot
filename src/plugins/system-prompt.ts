/**
 * System Prompt Plugin - Dynamic system prompt management
 *
 * Manages system prompts with persona support, dynamic variables,
 * and context-aware prompt injection.
 */

import type { Plugin, MiddlewareContext } from '../types/index.js';

export interface Persona {
  name: string;
  description: string;
  systemPrompt: string;
  temperature?: number;
  traits?: string[];
}

export interface SystemPromptPluginOptions {
  /** Default persona */
  defaultPersona?: Persona;
  /** Available personas */
  personas?: Persona[];
  /** Dynamic variables to inject into prompts */
  variables?: Record<string, string | (() => string)>;
  /** Prefix to add before the system prompt */
  prefix?: string;
  /** Suffix to add after the system prompt */
  suffix?: string;
}

/**
 * Create a system prompt plugin
 */
export function createSystemPromptPlugin(options?: SystemPromptPluginOptions): Plugin {
  const personas = new Map<string, Persona>();
  const activePersona: Persona | null = options?.defaultPersona ?? null;

  // Register provided personas
  if (options?.personas) {
    for (const persona of options.personas) {
      personas.set(persona.name, persona);
    }
  }
  if (options?.defaultPersona) {
    personas.set(options.defaultPersona.name, options.defaultPersona);
  }

  function resolveVariables(prompt: string, vars: Record<string, string | (() => string)>): string {
    let resolved = prompt;
    for (const [key, value] of Object.entries(vars)) {
      const replacement = typeof value === 'function' ? value() : value;
      resolved = resolved.replaceAll(`{{${key}}}`, replacement);
    }
    return resolved;
  }

  return {
    name: 'system-prompt',
    version: '1.0.0',
    description: 'Dynamic system prompt management with persona support',
    hooks: {
      onBeforeChat: async (context: MiddlewareContext): Promise<MiddlewareContext> => {
        let systemPrompt = activePersona?.systemPrompt ?? context.config.systemPrompt;

        // Apply prefix/suffix
        if (options?.prefix) {
          systemPrompt = `${options.prefix}\n${systemPrompt}`;
        }
        if (options?.suffix) {
          systemPrompt = `${systemPrompt}\n${options.suffix}`;
        }

        // Resolve variables
        if (options?.variables) {
          systemPrompt = resolveVariables(systemPrompt, options.variables);
        }

        // Update conversation metadata with resolved prompt
        const updatedConversation = {
          ...context.conversation,
          metadata: {
            ...context.conversation.metadata,
            systemPrompt,
          },
        };

        return {
          ...context,
          conversation: updatedConversation,
          metadata: {
            ...context.metadata,
            activePersona: activePersona?.name,
          },
        };
      },
    },
  };
}

/**
 * Pre-built personas
 */
export const BUILT_IN_PERSONAS: Record<string, Persona> = {
  helpful: {
    name: 'helpful',
    description: 'A helpful and friendly AI assistant',
    systemPrompt:
      'You are a helpful, friendly AI assistant. Provide clear, accurate, and concise answers. ' +
      'When you are unsure, say so rather than making up information.',
    temperature: 0.7,
    traits: ['helpful', 'friendly', 'honest'],
  },
  technical: {
    name: 'technical',
    description: 'A technical expert focused on accuracy',
    systemPrompt:
      'You are a technical AI assistant specializing in software engineering. ' +
      'Provide detailed, accurate technical answers with code examples when appropriate. ' +
      'Cite best practices and explain trade-offs.',
    temperature: 0.3,
    traits: ['technical', 'precise', 'thorough'],
  },
  creative: {
    name: 'creative',
    description: 'A creative writing assistant',
    systemPrompt:
      'You are a creative AI assistant. Help with brainstorming, writing, and creative tasks. ' +
      'Be imaginative, use vivid language, and explore unconventional ideas.',
    temperature: 1.0,
    traits: ['creative', 'imaginative', 'expressive'],
  },
  concise: {
    name: 'concise',
    description: 'A minimal, to-the-point assistant',
    systemPrompt:
      'You are a concise AI assistant. Give brief, direct answers without unnecessary elaboration. ' +
      'Use bullet points and short sentences. Get to the point quickly.',
    temperature: 0.5,
    traits: ['concise', 'direct', 'efficient'],
  },
};
