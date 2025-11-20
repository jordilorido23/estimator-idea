import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@scopeguard/db';
import { StatusBadge } from '@scopeguard/ui';
import Link from 'next/link';
import Image from 'next/image';

type PageProps = {
  params: {
    id: string;
  };
};

export default async function LeadDetailPage({ params }: PageProps) {
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

  const lead = await prisma.lead.findFirst({
    where: {
      id: params.id,
      contractorId: contractorUser.contractorId,
    },
    include: {
      photos: true,
      takeoffs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      estimates: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!lead) {
    notFound();
  }

  const latestTakeoff = lead.takeoffs[0];
  const takeoffData = latestTakeoff?.data as any;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/leads"
            className="mb-2 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to leads
          </Link>
          <h2 className="text-2xl font-bold">{lead.homeownerName}</h2>
          <p className="text-muted-foreground">{lead.address}</p>
        </div>
        <StatusBadge status={lead.status} size="lg" />
      </div>

      {/* Lead details */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          {/* Contact info */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold">Contact Information</h3>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Email</dt>
                <dd className="text-sm">{lead.homeownerEmail}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Phone</dt>
                <dd className="text-sm">{lead.homeownerPhone}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Address</dt>
                <dd className="text-sm">{lead.address}</dd>
              </div>
            </dl>
          </div>

          {/* Project details */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold">Project Details</h3>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Trade Type</dt>
                <dd className="text-sm">{lead.tradeType}</dd>
              </div>
              {lead.budgetCents && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Budget</dt>
                  <dd className="text-sm">${(lead.budgetCents / 100).toLocaleString()}</dd>
                </div>
              )}
              {lead.timeline && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Timeline</dt>
                  <dd className="text-sm">{lead.timeline}</dd>
                </div>
              )}
              {lead.notes && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Notes</dt>
                  <dd className="text-sm">{lead.notes}</dd>
                </div>
              )}
              {lead.score !== null && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Lead Score</dt>
                  <dd className="text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full bg-green-500"
                          style={{ width: `${lead.score}%` }}
                        />
                      </div>
                      <span>{Math.round(lead.score)}/100</span>
                    </div>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Photos */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Photos ({lead.photos.length})</h3>
          {lead.photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No photos uploaded</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {lead.photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative aspect-square overflow-hidden rounded-lg border"
                >
                  <Image
                    src={photo.url}
                    alt="Project photo"
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Analysis */}
      {!latestTakeoff && lead.photos.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <h3 className="mb-2 text-lg font-semibold">AI Analysis</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            This lead has photos but hasn't been analyzed yet.
          </p>
          <form action={`/api/leads/${lead.id}/analyze`} method="POST">
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Analyze with AI
            </button>
          </form>
        </div>
      )}

      {latestTakeoff && takeoffData && (
        <div className="space-y-6">
          {/* Scope of work */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold">AI-Generated Scope of Work</h3>
            <p className="mb-4 text-sm">{takeoffData.scopeOfWork?.summary}</p>

            <h4 className="mb-2 text-sm font-semibold">Line Items</h4>
            <ul className="mb-4 space-y-2">
              {takeoffData.scopeOfWork?.lineItems?.map((item: any, i: number) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">{item.category}:</span> {item.description}
                  {item.notes && (
                    <span className="text-muted-foreground"> ({item.notes})</span>
                  )}
                </li>
              ))}
            </ul>

            {takeoffData.scopeOfWork?.potentialIssues?.length > 0 && (
              <>
                <h4 className="mb-2 text-sm font-semibold text-orange-700">
                  Potential Issues
                </h4>
                <ul className="mb-4 list-inside list-disc space-y-1 text-sm text-orange-700">
                  {takeoffData.scopeOfWork.potentialIssues.map((issue: string, i: number) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </>
            )}

            {takeoffData.scopeOfWork?.missingInformation?.length > 0 && (
              <>
                <h4 className="mb-2 text-sm font-semibold text-yellow-700">
                  Missing Information
                </h4>
                <ul className="list-inside list-disc space-y-1 text-sm text-yellow-700">
                  {takeoffData.scopeOfWork.missingInformation.map((info: string, i: number) => (
                    <li key={i}>{info}</li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Photo analyses */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="mb-4 text-lg font-semibold">Photo Analysis Details</h3>
            <div className="space-y-4">
              {takeoffData.photoAnalyses?.map((photoData: any, i: number) => (
                <div key={i} className="rounded-lg border p-4">
                  <h4 className="mb-2 text-sm font-semibold">Photo {i + 1}</h4>
                  <dl className="space-y-1 text-sm">
                    <div>
                      <dt className="inline font-medium">Trades: </dt>
                      <dd className="inline">{photoData.analysis.tradeType.join(', ')}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">Materials: </dt>
                      <dd className="inline">{photoData.analysis.materials.join(', ')}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">Confidence: </dt>
                      <dd className="inline">{Math.round(photoData.analysis.confidence * 100)}%</dd>
                    </div>
                    {photoData.analysis.notes && (
                      <div>
                        <dt className="font-medium">Notes:</dt>
                        <dd className="text-muted-foreground">{photoData.analysis.notes}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Estimates */}
      {lead.estimates.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="mb-4 text-lg font-semibold">Estimates</h3>
          <div className="space-y-2">
            {lead.estimates.map((estimate) => (
              <Link
                key={estimate.id}
                href={`/dashboard/leads/${lead.id}/estimate/${estimate.id}`}
                className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50"
              >
                <div>
                  <div className="font-medium">
                    ${estimate.total.toString()} • {estimate.status}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Created {new Date(estimate.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span className="text-sm text-primary">View →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {latestTakeoff && lead.estimates.length === 0 && (
        <div className="flex gap-4">
          <Link
            href={`/dashboard/leads/${lead.id}/estimate/new`}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create Estimate
          </Link>
        </div>
      )}
    </div>
  );
}
