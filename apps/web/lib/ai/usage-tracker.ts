/**
 * AI Usage Tracking Utility
 *
 * Tracks AI API usage (tokens and estimated costs) for billing and monitoring.
 */

import { prisma } from '@scopeguard/db';
import type { Message } from '@anthropic-ai/sdk/resources';

/**
 * Pricing for Anthropic Claude models (as of January 2025)
 * Source: https://www.anthropic.com/api
 */
const MODEL_PRICING = {
  'claude-3-5-sonnet-20241022': {
    inputCostPer1M: 3.0, // $3 per 1M input tokens
    outputCostPer1M: 15.0, // $15 per 1M output tokens
  },
  'claude-3-5-haiku-20241022': {
    inputCostPer1M: 0.8, // $0.80 per 1M input tokens
    outputCostPer1M: 4.0, // $4 per 1M output tokens
  },
} as const;

type AIOperation = 'photo_analysis' | 'scope_generation' | 'estimate_generation';

interface TrackUsageParams {
  contractorId: string;
  leadId?: string;
  estimateId?: string;
  operation: AIOperation;
  model: string;
  response: Message;
  metadata?: Record<string, any>;
}

/**
 * Calculate estimated cost in USD based on token usage
 */
function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING];

  if (!pricing) {
    console.warn(`Unknown model for pricing: ${model}, using Sonnet pricing as fallback`);
    const fallbackPricing = MODEL_PRICING['claude-3-5-sonnet-20241022'];
    return (
      (inputTokens / 1_000_000) * fallbackPricing.inputCostPer1M +
      (outputTokens / 1_000_000) * fallbackPricing.outputCostPer1M
    );
  }

  return (
    (inputTokens / 1_000_000) * pricing.inputCostPer1M +
    (outputTokens / 1_000_000) * pricing.outputCostPer1M
  );
}

/**
 * Track AI API usage in the database
 */
export async function trackAIUsage({
  contractorId,
  leadId,
  estimateId,
  operation,
  model,
  response,
  metadata,
}: TrackUsageParams): Promise<void> {
  try {
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const totalTokens = inputTokens + outputTokens;
    const estimatedCost = calculateCost(model, inputTokens, outputTokens);

    await prisma.aIUsage.create({
      data: {
        contractorId,
        leadId,
        estimateId,
        operation,
        model,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost,
        metadata,
      },
    });

    console.log(`[AI Usage] ${operation} - ${totalTokens} tokens ($${estimatedCost.toFixed(4)})`);
  } catch (error) {
    // Don't throw - usage tracking should never break the main flow
    console.error('Failed to track AI usage:', error);
  }
}

/**
 * Get AI usage statistics for a contractor
 */
export async function getContractorAIUsage(
  contractorId: string,
  startDate?: Date,
  endDate?: Date
) {
  const where: any = { contractorId };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [usage, totalCost] = await Promise.all([
    // Get detailed usage records
    prisma.aIUsage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    // Get total cost
    prisma.aIUsage.aggregate({
      where,
      _sum: {
        estimatedCost: true,
        totalTokens: true,
      },
    }),
  ]);

  return {
    usage,
    totalCost: totalCost._sum.estimatedCost?.toNumber() || 0,
    totalTokens: totalCost._sum.totalTokens || 0,
  };
}

/**
 * Get AI usage summary by operation type
 */
export async function getUsageSummaryByOperation(
  contractorId: string,
  startDate?: Date,
  endDate?: Date
) {
  const where: any = { contractorId };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const summary = await prisma.aIUsage.groupBy({
    by: ['operation'],
    where,
    _sum: {
      totalTokens: true,
      estimatedCost: true,
    },
    _count: {
      id: true,
    },
  });

  return summary.map((s) => ({
    operation: s.operation,
    count: s._count.id,
    totalTokens: s._sum.totalTokens || 0,
    totalCost: s._sum.estimatedCost?.toNumber() || 0,
  }));
}

/**
 * Get AI usage for a specific lead
 */
export async function getLeadAIUsage(leadId: string) {
  const usage = await prisma.aIUsage.findMany({
    where: { leadId },
    orderBy: { createdAt: 'desc' },
  });

  const totalCost = usage.reduce((sum, u) => sum + u.estimatedCost.toNumber(), 0);
  const totalTokens = usage.reduce((sum, u) => sum + u.totalTokens, 0);

  return {
    usage,
    totalCost,
    totalTokens,
  };
}

/**
 * Check if contractor is approaching budget limit (if configured)
 */
export async function checkBudgetAlert(
  contractorId: string,
  monthlyBudget: number
): Promise<{ exceeded: boolean; usage: number; budget: number }> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const result = await prisma.aIUsage.aggregate({
    where: {
      contractorId,
      createdAt: { gte: startOfMonth },
    },
    _sum: {
      estimatedCost: true,
    },
  });

  const usage = result._sum.estimatedCost?.toNumber() || 0;

  return {
    exceeded: usage >= monthlyBudget,
    usage,
    budget: monthlyBudget,
  };
}
