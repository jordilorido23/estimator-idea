import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@scopeguard/db';
import { StatusBadge } from '@scopeguard/ui';
import Link from 'next/link';
import { getAuth } from '@/lib/test-auth-helpers';

export default async function DashboardPage() {
  const authResult = await getAuth();

  if (!authResult.userId) {
    redirect('/sign-in');
  }

  const userEmail = authResult.sessionClaims?.email as string | undefined;

  if (!userEmail) {
    redirect('/sign-in');
  }

  const contractorUser = await prisma.contractorUser.findUnique({
    where: { email: userEmail },
    include: {
      contractor: true,
    },
  });

  if (!contractorUser) {
    redirect('/sign-in');
  }

  // Fetch dashboard stats
  const [totalLeads, newLeads, qualifiedLeads, recentLeads] = await Promise.all([
    prisma.lead.count({
      where: { contractorId: contractorUser.contractor.id },
    }),
    prisma.lead.count({
      where: {
        contractorId: contractorUser.contractor.id,
        status: 'NEW',
      },
    }),
    prisma.lead.count({
      where: {
        contractorId: contractorUser.contractor.id,
        status: 'QUALIFIED',
      },
    }),
    prisma.lead.findMany({
      where: { contractorId: contractorUser.contractor.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        photos: {
          take: 1,
        },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome back, {contractorUser.contractor.companyName}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">Total Leads</div>
          <div className="mt-2 text-3xl font-bold">{totalLeads}</div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">New Leads</div>
          <div className="mt-2 text-3xl font-bold">{newLeads}</div>
          <p className="mt-1 text-xs text-muted-foreground">Needs review</p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">Qualified Leads</div>
          <div className="mt-2 text-3xl font-bold">{qualifiedLeads}</div>
          <p className="mt-1 text-xs text-muted-foreground">Ready to estimate</p>
        </div>
      </div>

      {/* Recent leads */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Recent Leads</h3>
          <Link
            href="/dashboard/leads"
            className="text-sm text-primary hover:underline"
          >
            View all
          </Link>
        </div>

        <div className="rounded-lg border">
          <div className="divide-y">
            {recentLeads.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No leads yet. Share your intake form to start receiving leads.
              </div>
            ) : (
              recentLeads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/dashboard/leads/${lead.id}`}
                  className="block p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{lead.homeownerName}</div>
                      <div className="text-sm text-muted-foreground">
                        {lead.tradeType} • {lead.address}
                      </div>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={lead.status} />
                      {lead.score !== null && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Score: {Math.round(lead.score)}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
