import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/src/env';

let cachedClient: Anthropic | null = null;

/**
 * Get or create a singleton Anthropic client instance
 */
export const getAnthropicClient = () => {
  if (!cachedClient) {
    cachedClient = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
    });
  }

  return cachedClient;
};

/**
 * Model configurations for different AI tasks
 */
export const AI_MODELS = {
  // Best for vision tasks and complex analysis
  SONNET: 'claude-3-5-sonnet-20241022',
  // Cost-effective for simple text generation
  HAIKU: 'claude-3-5-haiku-20241022',
} as const;
