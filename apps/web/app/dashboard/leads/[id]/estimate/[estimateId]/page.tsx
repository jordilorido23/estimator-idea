import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@scopeguard/db';
import Link from 'next/link';

type PageProps = {
  params: {
    id: string;
    estimateId: string;
  };
};

export default async function EstimateDetailPage({ params }: PageProps) {
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

  const estimate = await prisma.estimate.findFirst({
    where: {
      id: params.estimateId,
      leadId: params.id,
      contractorId: contractorUser.contractorId,
    },
    include: {
      lead: {
        include: {
          takeoffs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  if (!estimate) {
    notFound();
  }

  const lineItems = estimate.lineItems as any[];
  const latestTakeoff = estimate.lead.takeoffs[0];
  const takeoffData = latestTakeoff?.data as any;
  const scopeOfWork = takeoffData?.scopeOfWork;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/dashboard/leads/${params.id}`}
            className="mb-2 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to lead
          </Link>
          <h2 className="text-2xl font-bold">Estimate</h2>
          <p className="text-muted-foreground">
            {estimate.lead.homeownerName} • {estimate.lead.address}
          </p>
        </div>
        <div>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
              estimate.status === 'DRAFT'
                ? 'bg-gray-100 text-gray-800'
                : estimate.status === 'SENT'
                  ? 'bg-blue-100 text-blue-800'
                  : estimate.status === 'ACCEPTED'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
            }`}
          >
            {estimate.status}
          </span>
        </div>
      </div>

      {/* Scope of work reference */}
      {scopeOfWork && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <h3 className="mb-2 text-sm font-semibold">Scope of Work</h3>
          <p className="text-sm text-muted-foreground">{scopeOfWork.summary}</p>
        </div>
      )}

      {/* Line items */}
      <div className="rounded-lg border bg-card">
        <div className="border-b p-6">
          <h3 className="text-lg font-semibold">Line Items</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Qty</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Unit</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Unit Cost</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lineItems.map((item, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 text-sm font-medium">{item.category}</td>
                  <td className="px-4 py-3 text-sm">
                    <div>{item.description}</div>
                    {item.notes && (
                      <div className="text-xs text-muted-foreground">{item.notes}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">{item.quantity}</td>
                  <td className="px-4 py-3 text-sm">{item.unit}</td>
                  <td className="px-4 py-3 text-right text-sm">
                    ${item.unitCost.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    ${item.totalCost.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Summary</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">${estimate.subtotal.toString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Margin ({estimate.margin.toString()}%)
            </span>
            <span className="font-medium">
              ${((parseFloat(estimate.subtotal.toString()) * parseFloat(estimate.margin.toString())) / 100).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Contingency ({estimate.contingency.toString()}%)
            </span>
            <span className="font-medium">
              ${((parseFloat(estimate.subtotal.toString()) * parseFloat(estimate.contingency.toString())) / 100).toFixed(2)}
            </span>
          </div>
          <div className="border-t pt-2">
            <div className="flex justify-between">
              <span className="text-lg font-semibold">Total</span>
              <span className="text-2xl font-bold">${estimate.total.toString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        {estimate.status === 'DRAFT' && (
          <>
            <button className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
              Edit Line Items
            </button>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Generate PDF Proposal (Coming Soon)
            </button>
          </>
        )}
      </div>

      {/* AI Notes */}
      {scopeOfWork?.assumptions && scopeOfWork.assumptions.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Assumptions</h3>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {scopeOfWork.assumptions.map((assumption: string, i: number) => (
              <li key={i}>{assumption}</li>
            ))}
          </ul>
        </div>
      )}

      {scopeOfWork?.exclusions && scopeOfWork.exclusions.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Exclusions</h3>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {scopeOfWork.exclusions.map((exclusion: string, i: number) => (
              <li key={i}>{exclusion}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
