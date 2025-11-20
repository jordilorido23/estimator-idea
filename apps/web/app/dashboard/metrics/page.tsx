import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@scopeguard/db';
import Link from 'next/link';
import { AccuracyMetricsCard } from '@/components/accuracy-metrics-card';
import {
  calculateAccuracyMetrics,
  getEstimatesWithMetrics,
  getAccuracyTrends,
} from '@/lib/metrics';

export default async function MetricsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const user = await auth();
  const userEmail = user.sessionClaims?.email as string | undefined;

  if (!userEmail) {
    redirect('/sign-in');
  }

  const contractorUser = await prisma.contractorUser.findUnique({
    where: { email: userEmail },
  });

  if (!contractorUser) {
    redirect('/sign-in');
  }

  // Fetch metrics data
  const metrics = await calculateAccuracyMetrics(contractorUser.contractorId);
  const recentEstimates = await getEstimatesWithMetrics(
    contractorUser.contractorId,
    { limit: 10 }
  );
  const trends = await getAccuracyTrends(contractorUser.contractorId, 6);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard"
          className="mb-2 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to dashboard
        </Link>
        <h2 className="text-2xl font-bold">Accuracy Metrics</h2>
        <p className="text-muted-foreground">
          Track your estimate accuracy and project outcomes
        </p>
      </div>

      {/* Metrics Cards */}
      <AccuracyMetricsCard
        metrics={metrics}
        recentEstimates={recentEstimates}
        trends={trends}
      />

      {/* Recent Estimates Table */}
      {recentEstimates.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="border-b p-6">
            <h3 className="text-lg font-semibold">Recent Estimates with Feedback</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Customer</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Address</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Estimated</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Actual</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Variance</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">Outcome</th>
                  <th className="px-4 py-3 text-center text-sm font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentEstimates.map((estimate) => (
                  <tr key={estimate.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm font-medium">
                      <Link
                        href={`/dashboard/leads/${estimate.leadId}/estimate/${estimate.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {estimate.homeownerName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {estimate.address}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      ${estimate.total.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {estimate.actualCost
                        ? `$${estimate.actualCost.toLocaleString()}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {estimate.variancePercent !== null ? (
                        <span
                          className={
                            Math.abs(estimate.variancePercent) <= 10
                              ? 'text-green-600 font-medium'
                              : 'text-red-600 font-medium'
                          }
                        >
                          {estimate.variancePercent > 0 ? '+' : ''}
                          {estimate.variancePercent.toFixed(1)}%
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          estimate.projectOutcome === 'WON'
                            ? 'bg-green-100 text-green-800'
                            : estimate.projectOutcome === 'LOST'
                              ? 'bg-red-100 text-red-800'
                              : estimate.projectOutcome === 'IN_PROGRESS'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {estimate.projectOutcome}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                      {estimate.completedAt
                        ? new Date(estimate.completedAt).toLocaleDateString()
                        : new Date(estimate.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recentEstimates.length === 0 && (
        <div className="rounded-lg border bg-card p-12 text-center">
          <h3 className="text-lg font-semibold mb-2">No Estimate Feedback Yet</h3>
          <p className="text-muted-foreground mb-4">
            Start adding feedback to your estimates to see accuracy metrics here.
          </p>
          <Link
            href="/dashboard/leads"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            View Leads →
          </Link>
        </div>
      )}
    </div>
  );
}
