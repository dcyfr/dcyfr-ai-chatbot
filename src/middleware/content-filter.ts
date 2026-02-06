/**
 * Content Filter Middleware - Content safety and moderation
 *
 * Filters messages for profanity, PII, prompt injection attempts,
 * and other harmful content before sending to the LLM.
 */

import type {
  ContentFilterResult,
  ContentFilterRule,
  Middleware,
  MiddlewareContext,
  MiddlewareResult,
} from '../types/index.js';

/** Default content filter rules */
export const DEFAULT_FILTER_RULES: ContentFilterRule[] = [
  {
    name: 'email-pii',
    type: 'pii',
    severity: 'medium',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    description: 'Email address detected',
  },
  {
    name: 'phone-pii',
    type: 'pii',
    severity: 'medium',
    pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
    description: 'Phone number detected',
  },
  {
    name: 'ssn-pii',
    type: 'pii',
    severity: 'critical',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/,
    description: 'SSN pattern detected',
  },
  {
    name: 'credit-card-pii',
    type: 'pii',
    severity: 'critical',
    pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/,
    description: 'Credit card number detected',
  },
  {
    name: 'prompt-injection',
    type: 'injection',
    severity: 'high',
    pattern: /(?:ignore|forget|disregard)\s+(?:all\s+)?(?:previous|above|prior)\s+(?:instructions|prompts|context)/i,
    description: 'Prompt injection attempt detected',
  },
  {
    name: 'system-prompt-extraction',
    type: 'injection',
    severity: 'high',
    pattern: /(?:show|reveal|display|output|print|repeat)\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions|rules)/i,
    description: 'System prompt extraction attempt detected',
  },
];

/**
 * Run content through filter rules
 */
export function filterContent(
  content: string,
  rules: ContentFilterRule[]
): ContentFilterResult {
  const flags: ContentFilterResult['flags'] = [];

  for (const rule of rules) {
    if (rule.pattern.test(content)) {
      flags.push({
        type: rule.type,
        severity: rule.severity,
        match: rule.name,
        description: rule.description,
      });
    }
  }

  return {
    safe: flags.length === 0,
    flags,
  };
}

export interface ContentFilterOptions {
  /** Custom rules (added to defaults) */
  rules?: ContentFilterRule[];
  /** Whether to use default rules */
  useDefaults?: boolean;
  /** Minimum severity to block (default: 'high') */
  blockSeverity?: 'low' | 'medium' | 'high' | 'critical';
  /** Whether to redact PII instead of blocking */
  redactPII?: boolean;
}

/**
 * Create a content filter middleware
 */
export function createContentFilter(options?: ContentFilterOptions): Middleware {
  const useDefaults = options?.useDefaults ?? true;
  const customRules = options?.rules ?? [];
  const rules = useDefaults ? [...DEFAULT_FILTER_RULES, ...customRules] : customRules;
  const blockSeverity = options?.blockSeverity ?? 'high';

  const severityOrder: Record<string, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };

  const blockThreshold = severityOrder[blockSeverity];

  return {
    name: 'content-filter',
    description: 'Content safety and moderation filter',
    priority: -90, // Run early, after rate limiter
    execute: async (
      context: MiddlewareContext,
      next: () => Promise<MiddlewareResult>
    ): Promise<MiddlewareResult> => {
      const result = filterContent(context.request.message, rules);

      if (!result.safe) {
        // Check if any flag meets the block threshold
        const shouldBlock = result.flags.some(
          (f) => severityOrder[f.severity] >= blockThreshold
        );

        if (shouldBlock) {
          const flagNames = result.flags.map((f) => f.match).join(', ');
          return {
            proceed: false,
            context,
            error: `Message blocked by content filter: ${flagNames}`,
          };
        }
      }

      // Store filter result in metadata
      context.metadata['contentFilterResult'] = result;
      return next();
    },
  };
}
