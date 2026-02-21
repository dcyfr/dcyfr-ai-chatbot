/**
 * OpenAI-Compatible Provider - Works with OpenAI API and compatible services
 *
 * Supports any API that implements the OpenAI chat completions format,
 * including OpenAI, Azure OpenAI, Ollama, Together AI, and others.
 *
 * NOTE: This is a reference implementation. In production, you would
 * use the official OpenAI SDK or a similar client library.
 */

import type {
  ChatProvider,
  ProviderConfig,
  ProviderRequest,
  ProviderResponse,
  StreamChunk,
} from '../types/index.js';
import { createMessage } from '../chat/message.js';
import { createStreamChunk } from '../streaming/stream-handler.js';

/**
 * OpenAI-compatible chat provider
 *
 * This is a lightweight implementation for the template.
 * For production use, consider using the official `openai` npm package.
 */
export class OpenAIProvider implements ChatProvider {
  readonly name = 'openai';
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }
  }

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const response = await this.fetchCompletion(request, false);

    const data = (await response.json()) as OpenAIChatCompletionResponse;
    const choice = data.choices[0];

    const message = createMessage('assistant', choice.message.content ?? '', {
      model: data.model,
      tokens: data.usage?.completion_tokens,
      finishReason: mapFinishReason(choice.finish_reason),
    });

    return {
      message,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      finishReason: mapFinishReason(choice.finish_reason),
    };
  }

  async *stream(request: ProviderRequest): AsyncIterable<StreamChunk> {
    const response = await this.fetchCompletion(request, true);
    const reader = response.body?.getReader();

    if (!reader) {
      yield createStreamChunk('error', 'No response body for streaming');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const chunk = this.parseStreamLine(line);
          if (chunk === 'done') {
            yield createStreamChunk('done', null);
            return;
          }
          if (chunk !== null) {
            yield createStreamChunk('token', chunk);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield createStreamChunk('done', null);
  }

  /** Parse one SSE line, returning token content, 'done', or null to skip. */
  private parseStreamLine(line: string): string | 'done' | null {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('data: ')) return null;
    const data = trimmed.slice(6);
    if (data === '[DONE]') return 'done';
    try {
      const parsed = JSON.parse(data) as OpenAIStreamChunk;
      const delta = parsed.choices[0]?.delta;
      return delta?.content ?? null;
    } catch {
      return null; // Skip malformed JSON lines
    }
  }

  private async fetchCompletion(
    request: ProviderRequest,
    stream: boolean
  ): Promise<Response> {
    const baseUrl = this.config.baseUrl ?? 'https://api.openai.com/v1';
    const url = `${baseUrl}/chat/completions`;

    const body: Record<string, unknown> = {
      model: request.model ?? this.config.model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.name ? { name: m.name } : {}),
      })),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream,
    };

    if (request.tools && request.tools.length > 0) {
      body['tools'] = request.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    return response;
  }
}

// OpenAI API response types (minimal)
interface OpenAIChatCompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    message: { role: string; content: string | null };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamChunk {
  choices: Array<{
    delta: { content?: string; role?: string };
    finish_reason: string | null;
  }>;
}

function mapFinishReason(
  reason: string
): 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error' {
  switch (reason) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    case 'tool_calls':
    case 'function_call':
      return 'tool_calls';
    case 'content_filter':
      return 'content_filter';
    default:
      return 'stop';
  }
}
