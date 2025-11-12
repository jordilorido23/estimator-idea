import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@scopeguard/db';
import Link from 'next/link';

type SearchParams = {
  status?: string;
  tradeType?: string;
  sort?: string;
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
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
    include: {
      contractor: true,
    },
  });

  if (!contractorUser) {
    redirect('/sign-in');
  }

  // Build where clause from filters
  const where: any = {
    contractorId: contractorUser.contractor.id,
  };

  if (searchParams.status) {
    where.status = searchParams.status;
  }

  if (searchParams.tradeType) {
    where.tradeType = searchParams.tradeType;
  }

  // Build orderBy
  const orderBy: any = {};
  if (searchParams.sort === 'score') {
    orderBy.score = 'desc';
  } else if (searchParams.sort === 'oldest') {
    orderBy.createdAt = 'asc';
  } else {
    orderBy.createdAt = 'desc'; // default to newest first
  }

  const leads = await prisma.lead.findMany({
    where,
    orderBy,
    include: {
      photos: {
        take: 1,
      },
      takeoffs: {
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Leads</h2>
          <p className="text-muted-foreground">
            Manage and review your incoming project leads
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 rounded-lg border bg-card p-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Status</label>
          <select
            className="rounded-md border px-3 py-2 text-sm"
            defaultValue={searchParams.status || ''}
            onChange={(e) => {
              const url = new URL(window.location.href);
              if (e.target.value) {
                url.searchParams.set('status', e.target.value);
              } else {
                url.searchParams.delete('status');
              }
              window.location.href = url.toString();
            }}
          >
            <option value="">All statuses</option>
            <option value="NEW">New</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="ESTIMATED">Estimated</option>
            <option value="DECLINED">Declined</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Sort by</label>
          <select
            className="rounded-md border px-3 py-2 text-sm"
            defaultValue={searchParams.sort || 'newest'}
            onChange={(e) => {
              const url = new URL(window.location.href);
              url.searchParams.set('sort', e.target.value);
              window.location.href = url.toString();
            }}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="score">Highest score</option>
          </select>
        </div>
      </div>

      {/* Leads table */}
      <div className="rounded-lg border">
        <table className="w-full">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Homeowner</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Trade Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Score</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Photos</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Created</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No leads found. Try adjusting your filters.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="transition-colors hover:bg-muted/50"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{lead.homeownerName}</div>
                    <div className="text-xs text-muted-foreground">
                      {lead.homeownerEmail}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{lead.tradeType}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        lead.status === 'NEW'
                          ? 'bg-blue-100 text-blue-800'
                          : lead.status === 'QUALIFIED'
                            ? 'bg-green-100 text-green-800'
                            : lead.status === 'ESTIMATED'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {lead.score !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full bg-green-500"
                            style={{ width: `${lead.score}%` }}
                          />
                        </div>
                        <span className="text-xs">{Math.round(lead.score)}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{lead.photos.length}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(lead.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/leads/${lead.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
