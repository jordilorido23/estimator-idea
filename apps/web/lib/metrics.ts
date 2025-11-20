import { prisma } from '@scopeguard/db';
import type { Prisma } from '@scopeguard/db';

export interface AccuracyMetrics {
  totalEstimates: number;
  completedEstimates: number;
  wonEstimates: number;
  lostEstimates: number;
  averageVariance: number;
  averageVariancePercent: number;
  estimatesWithinTarget: number; // Within 10% of estimate
  accuracyRate: number; // Percentage within 10%
  totalEstimatedValue: number;
  totalActualValue: number;
}

export interface EstimateWithMetrics {
  id: string;
  leadId: string;
  homeownerName: string;
  address: string;
  total: number;
  actualCost: number | null;
  variance: number | null;
  variancePercent: number | null;
  projectOutcome: string | null;
  completedAt: Date | null;
  createdAt: Date;
}

/**
 * Calculate accuracy metrics for a contractor's estimates
 */
export async function calculateAccuracyMetrics(
  contractorId: string
): Promise<AccuracyMetrics> {
  // Get all estimates with feedback for this contractor
  const estimates = await prisma.estimate.findMany({
    where: {
      contractorId,
      projectOutcome: {
        not: null,
      },
    },
    select: {
      total: true,
      actualCost: true,
      variance: true,
      variancePercent: true,
      projectOutcome: true,
    },
  });

  const totalEstimates = estimates.length;
  const completedEstimates = estimates.filter(
    (e) => e.projectOutcome === 'WON' || e.projectOutcome === 'LOST'
  ).length;
  const wonEstimates = estimates.filter((e) => e.projectOutcome === 'WON').length;
  const lostEstimates = estimates.filter((e) => e.projectOutcome === 'LOST').length;

  // Calculate variance metrics (only for estimates with actual costs)
  const estimatesWithActualCost = estimates.filter(
    (e) => e.actualCost !== null && e.variance !== null && e.variancePercent !== null
  );

  let averageVariance = 0;
  let averageVariancePercent = 0;
  let estimatesWithinTarget = 0;
  let totalEstimatedValue = 0;
  let totalActualValue = 0;

  if (estimatesWithActualCost.length > 0) {
    const totalVariance = estimatesWithActualCost.reduce(
      (sum, e) => sum + (e.variance?.toNumber() || 0),
      0
    );
    averageVariance = totalVariance / estimatesWithActualCost.length;

    const totalVariancePercent = estimatesWithActualCost.reduce(
      (sum, e) => sum + Math.abs(e.variancePercent?.toNumber() || 0),
      0
    );
    averageVariancePercent = totalVariancePercent / estimatesWithActualCost.length;

    // Count estimates within 10% target
    estimatesWithinTarget = estimatesWithActualCost.filter(
      (e) => Math.abs(e.variancePercent?.toNumber() || 0) <= 10
    ).length;

    totalEstimatedValue = estimatesWithActualCost.reduce(
      (sum, e) => sum + e.total.toNumber(),
      0
    );

    totalActualValue = estimatesWithActualCost.reduce(
      (sum, e) => sum + (e.actualCost?.toNumber() || 0),
      0
    );
  }

  const accuracyRate =
    estimatesWithActualCost.length > 0
      ? (estimatesWithinTarget / estimatesWithActualCost.length) * 100
      : 0;

  return {
    totalEstimates,
    completedEstimates,
    wonEstimates,
    lostEstimates,
    averageVariance,
    averageVariancePercent,
    estimatesWithinTarget,
    accuracyRate,
    totalEstimatedValue,
    totalActualValue,
  };
}

/**
 * Get detailed estimates with metrics for a contractor
 */
export async function getEstimatesWithMetrics(
  contractorId: string,
  options?: {
    outcomeFilter?: 'WON' | 'LOST' | 'IN_PROGRESS' | 'CANCELLED';
    limit?: number;
  }
): Promise<EstimateWithMetrics[]> {
  const where: Prisma.EstimateWhereInput = {
    contractorId,
    projectOutcome: options?.outcomeFilter || {
      not: null,
    },
  };

  const estimates = await prisma.estimate.findMany({
    where,
    select: {
      id: true,
      leadId: true,
      total: true,
      actualCost: true,
      variance: true,
      variancePercent: true,
      projectOutcome: true,
      completedAt: true,
      createdAt: true,
      lead: {
        select: {
          homeownerName: true,
          address: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: options?.limit,
  });

  return estimates.map((e) => ({
    id: e.id,
    leadId: e.leadId,
    homeownerName: e.lead.homeownerName,
    address: e.lead.address,
    total: e.total.toNumber(),
    actualCost: e.actualCost?.toNumber() || null,
    variance: e.variance?.toNumber() || null,
    variancePercent: e.variancePercent?.toNumber() || null,
    projectOutcome: e.projectOutcome,
    completedAt: e.completedAt,
    createdAt: e.createdAt,
  }));
}

/**
 * Get accuracy trends over time (monthly)
 */
export async function getAccuracyTrends(
  contractorId: string,
  months: number = 6
): Promise<
  Array<{
    month: string;
    averageVariancePercent: number;
    estimatesCount: number;
  }>
> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const estimates = await prisma.estimate.findMany({
    where: {
      contractorId,
      projectOutcome: {
        not: null,
      },
      actualCost: {
        not: null,
      },
      completedAt: {
        gte: startDate,
      },
    },
    select: {
      variancePercent: true,
      completedAt: true,
    },
    orderBy: {
      completedAt: 'asc',
    },
  });

  // Group by month
  const monthlyData: Record<
    string,
    { total: number; count: number }
  > = {};

  estimates.forEach((e) => {
    if (e.completedAt && e.variancePercent) {
      const monthKey = e.completedAt.toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { total: 0, count: 0 };
      }
      monthlyData[monthKey].total += Math.abs(e.variancePercent.toNumber());
      monthlyData[monthKey].count += 1;
    }
  });

  // Convert to array and calculate averages
  return Object.entries(monthlyData).map(([month, data]) => ({
    month,
    averageVariancePercent: data.total / data.count,
    estimatesCount: data.count,
  }));
}
