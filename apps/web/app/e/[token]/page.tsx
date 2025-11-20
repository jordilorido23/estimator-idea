import { notFound } from 'next/navigation';
import { prisma } from '@scopeguard/db';
import { Badge } from '@scopeguard/ui';
import { PaymentButton } from './payment-button';

type PageProps = {
  params: {
    token: string;
  };
};

export default async function PublicEstimatePage({ params }: PageProps) {
  // Fetch estimate by public token
  const estimate = await prisma.estimate.findUnique({
    where: { publicToken: params.token },
    include: {
      lead: true,
      contractor: true,
      payments: {
        where: {
          status: 'COMPLETED',
        },
        orderBy: {
          paidAt: 'desc',
        },
      },
    },
  });

  if (!estimate) {
    notFound();
  }

  // Check if estimate is expired
  if (estimate.expiresAt && new Date() > estimate.expiresAt) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div data-testid="expired-message" className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-red-900">Estimate Expired</h1>
          <p className="text-red-700">
            This estimate expired on {estimate.expiresAt.toLocaleDateString()}. Please contact{' '}
            {estimate.contractor.companyName} for an updated estimate.
          </p>
          <div className="mt-6 space-y-1 text-sm text-red-600">
            <p>{estimate.contractor.email}</p>
            {estimate.contractor.phone && <p>{estimate.contractor.phone}</p>}
          </div>
        </div>
      </div>
    );
  }

  const lineItems = estimate.lineItems as any[];
  const depositAmount = (Number(estimate.total) * Number(estimate.contractor.depositPercentage)) / 100;
  const totalPaid = estimate.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const remainingBalance = Number(estimate.total) - totalPaid;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-gray-900">
              {estimate.contractor.companyName}
            </h1>
            <p className="text-sm text-gray-600">{estimate.contractor.email}</p>
            {estimate.contractor.phone && (
              <p className="text-sm text-gray-600">{estimate.contractor.phone}</p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-700">Project Proposal</h2>
              <p className="text-sm text-gray-500">
                Created {estimate.createdAt.toLocaleDateString()}
              </p>
            </div>
            <Badge
              variant={
                estimate.status === 'ACCEPTED'
                  ? 'default'
                  : estimate.status === 'SENT'
                    ? 'secondary'
                    : 'outline'
              }
            >
              {estimate.status}
            </Badge>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Client Information */}
        <div className="mb-8 rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Project Details</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-gray-500">Client Name</p>
              <p className="text-base text-gray-900">{estimate.lead.homeownerName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Property Address</p>
              <p className="text-base text-gray-900">{estimate.lead.address}</p>
            </div>
          </div>
        </div>

        {/* Confidence Level Indicator */}
        <div className="mb-8 rounded-lg border bg-white p-6 shadow-sm" data-testid="confidence-indicator">
          <div className="flex items-start gap-4">
            <div
              className={`rounded-full p-3 ${
                estimate.confidence === 'HIGH'
                  ? 'bg-green-100'
                  : estimate.confidence === 'MEDIUM'
                    ? 'bg-blue-100'
                    : 'bg-yellow-100'
              }`}
            >
              <svg
                className={`h-6 w-6 ${
                  estimate.confidence === 'HIGH'
                    ? 'text-green-600'
                    : estimate.confidence === 'MEDIUM'
                      ? 'text-blue-600'
                      : 'text-yellow-600'
                }`}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {estimate.confidence === 'HIGH' ? (
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : estimate.confidence === 'MEDIUM' ? (
                  <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                )}
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {estimate.confidence === 'HIGH'
                  ? 'High Confidence'
                  : estimate.confidence === 'MEDIUM'
                    ? 'Medium Confidence'
                    : 'Low Confidence'}
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                {estimate.confidence === 'HIGH'
                  ? 'Highly accurate estimate based on detailed analysis of your project photos and requirements.'
                  : estimate.confidence === 'MEDIUM'
                    ? 'Good estimate based on available information. Some assumptions were made that may need verification.'
                    : 'Preliminary estimate. Additional details and site inspection recommended for accurate pricing.'}
              </p>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="mb-8 overflow-hidden rounded-lg border bg-white shadow-sm">
          <div className="border-b bg-gray-50 p-4">
            <h3 className="text-lg font-semibold text-gray-900">Scope of Work</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Description
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Quantity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Unit
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Unit Price
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lineItems.map((item, i) => (
                  <tr key={i} data-testid={`line-item-${i}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="font-medium">{item.description}</div>
                      {item.notes && (
                        <div className="text-xs text-gray-500">{item.notes}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.unit}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      ${(item.unitCost || item.unitPrice || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                      ${(item.totalCost || item.total || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary and Payment */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Cost Breakdown */}
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Cost Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm" data-testid="subtotal">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium text-gray-900">
                  ${Number(estimate.subtotal).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm" data-testid="margin">
                <span className="text-gray-600">
                  Margin ({Number(estimate.margin).toFixed(0)}%)
                </span>
                <span className="font-medium text-gray-900">
                  ${((Number(estimate.subtotal) * Number(estimate.margin)) / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm" data-testid="contingency">
                <span className="text-gray-600">
                  Contingency ({Number(estimate.contingency).toFixed(0)}%)
                </span>
                <span className="font-medium text-gray-900">
                  ${((Number(estimate.subtotal) * Number(estimate.contingency)) / 100).toFixed(2)}
                </span>
              </div>
              <div className="border-t pt-3" data-testid="total-cost">
                <div className="flex justify-between">
                  <span className="text-base font-semibold text-gray-900">Total Project Cost</span>
                  <span className="text-2xl font-bold text-gray-900">
                    ${Number(estimate.total).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Payment Information</h3>
            {totalPaid > 0 ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-green-50 p-4">
                  <p className="text-sm font-medium text-green-900">Payment Received</p>
                  <p className="text-2xl font-bold text-green-700">
                    ${totalPaid.toFixed(2)}
                  </p>
                </div>

                {/* Payment History */}
                <div className="space-y-3">
                  <h4 className="text-base font-semibold text-gray-900">Payment History</h4>
                  <div className="space-y-2">
                    {estimate.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between rounded-lg border bg-gray-50 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                            <svg
                              className="h-4 w-4 text-green-600"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {payment.type === 'DEPOSIT'
                                ? 'Deposit'
                                : payment.type === 'MILESTONE'
                                  ? 'Milestone Payment'
                                  : 'Final Payment'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {payment.paidAt
                                ? new Date(payment.paidAt).toLocaleDateString()
                                : new Date(payment.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">
                          ${Number(payment.amount).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {remainingBalance > 0 && (
                  <>
                    <div className="space-y-2 border-t pt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Remaining Balance</span>
                        <span className="font-semibold text-gray-900">
                          ${remainingBalance.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      The remaining balance will be due upon project completion.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-blue-50 p-4" data-testid="deposit-amount">
                  <p className="text-sm font-medium text-blue-900">
                    Deposit Required ({Number(estimate.contractor.depositPercentage).toFixed(0)}%)
                  </p>
                  <p className="text-2xl font-bold text-blue-700">
                    ${depositAmount.toFixed(2)}
                  </p>
                </div>
                <p className="text-sm text-gray-600">
                  A deposit of ${depositAmount.toFixed(2)} is required to begin work. The
                  remaining balance of ${(Number(estimate.total) - depositAmount).toFixed(2)} will
                  be due upon completion.
                </p>
                {estimate.status === 'SENT' && (
                  <PaymentButton
                    estimateId={estimate.id}
                    amount={depositAmount}
                    contractorName={estimate.contractor.companyName}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 rounded-lg border bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-600">
            This proposal is valid for 30 days from the date above. Terms and conditions apply.
          </p>
          <p className="mt-2 text-xs text-gray-500">Estimate ID: {estimate.id}</p>
        </div>
      </div>
    </div>
  );
}
