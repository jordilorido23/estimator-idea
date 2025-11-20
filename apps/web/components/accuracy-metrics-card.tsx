'use client';

import { Card } from '@scopeguard/ui';
import type { AccuracyMetrics, EstimateWithMetrics } from '@/lib/metrics';

interface AccuracyMetricsCardProps {
  metrics: AccuracyMetrics;
  recentEstimates: EstimateWithMetrics[];
  trends: Array<{
    month: string;
    averageVariancePercent: number;
    estimatesCount: number;
  }>;
}

export function AccuracyMetricsCard({
  metrics,
  recentEstimates,
  trends,
}: AccuracyMetricsCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {/* Overall Accuracy */}
      <Card className="p-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Accuracy Rate
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold">
              {metrics.accuracyRate.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground">
              within ±10%
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {metrics.estimatesWithinTarget} of {metrics.completedEstimates} completed
          </p>
        </div>
      </Card>

      {/* Average Variance */}
      <Card className="p-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Avg Variance
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold">
              {Math.abs(metrics.averageVariancePercent).toFixed(1)}%
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(Math.abs(metrics.averageVariance))} avg difference
          </p>
        </div>
      </Card>

      {/* Win Rate */}
      <Card className="p-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Win Rate
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold">
              {metrics.totalEstimates > 0
                ? ((metrics.wonEstimates / metrics.totalEstimates) * 100).toFixed(1)
                : '0.0'}
              %
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {metrics.wonEstimates} won, {metrics.lostEstimates} lost
          </p>
        </div>
      </Card>

      {/* Total Value */}
      <Card className="p-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Total Tracked Value
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold">
              {formatCurrency(metrics.totalEstimatedValue)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(metrics.totalActualValue)} actual
          </p>
        </div>
      </Card>

      {/* Trends Chart */}
      {trends.length > 0 && (
        <Card className="p-6 md:col-span-2 lg:col-span-4">
          <h3 className="text-lg font-semibold mb-4">Accuracy Trends</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-6 gap-4">
              {trends.map((trend) => (
                <div key={trend.month} className="space-y-2">
                  <div className="text-center">
                    <div className="relative h-32 flex items-end justify-center">
                      <div
                        className={`w-full rounded-t ${
                          trend.averageVariancePercent <= 10
                            ? 'bg-green-500'
                            : trend.averageVariancePercent <= 20
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`}
                        style={{
                          height: `${Math.min((trend.averageVariancePercent / 30) * 100, 100)}%`,
                          minHeight: '8px',
                        }}
                      />
                    </div>
                    <p className="text-xs font-medium mt-2">
                      {trend.averageVariancePercent.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(trend.month + '-01').toLocaleDateString('en-US', {
                        month: 'short',
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ({trend.estimatesCount})
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span className="text-muted-foreground">≤10% variance</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-yellow-500" />
                <span className="text-muted-foreground">10-20% variance</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-500" />
                <span className="text-muted-foreground">&gt;20% variance</span>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
