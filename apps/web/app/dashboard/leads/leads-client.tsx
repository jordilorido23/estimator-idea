'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { StatusBadge } from '@scopeguard/ui';
import type { Lead, Photo, Takeoff } from '@scopeguard/db';

type LeadWithRelations = Lead & {
  photos: Photo[];
  takeoffs: Takeoff[];
};

interface LeadsClientProps {
  leads: LeadWithRelations[];
  initialStatus?: string;
  initialTradeType?: string;
  initialSort: string;
}

export function LeadsClient({ leads, initialStatus, initialTradeType, initialSort }: LeadsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/dashboard/leads?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Leads</h2>
          <p className="text-muted-foreground">
            Manage and review your incoming project leads
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row">
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium">Status</label>
          <select
            name="status"
            data-testid="status-filter"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={initialStatus || ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="NEW">New</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="ESTIMATED">Estimated</option>
            <option value="DECLINED">Declined</option>
          </select>
        </div>

        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium">Trade Type</label>
          <select
            name="tradeType"
            data-testid="trade-type-filter"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={initialTradeType || ''}
            onChange={(e) => handleFilterChange('tradeType', e.target.value)}
          >
            <option value="">All trades</option>
            <option value="ROOFING">Roofing</option>
            <option value="KITCHEN">Kitchen</option>
            <option value="BATH">Bath</option>
            <option value="FLOORING">Flooring</option>
            <option value="PAINTING">Painting</option>
            <option value="HVAC">HVAC</option>
            <option value="PLUMBING">Plumbing</option>
            <option value="ELECTRICAL">Electrical</option>
          </select>
        </div>

        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium">Sort by</label>
          <select
            name="sort"
            data-testid="sort-filter"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={initialSort}
            onChange={(e) => handleFilterChange('sort', e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="score">Highest score</option>
          </select>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden overflow-hidden rounded-lg border md:block">
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
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {lead.score !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full ${
                              lead.score >= 70
                                ? 'bg-green-500'
                                : lead.score >= 40
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                            }`}
                            style={{ width: `${lead.score}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">{Math.round(lead.score)}</span>
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
                      className="text-sm font-medium text-primary hover:underline"
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

      {/* Mobile Card View */}
      <div className="space-y-4 md:hidden">
        {leads.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            No leads found. Try adjusting your filters.
          </div>
        ) : (
          leads.map((lead) => (
            <Link
              key={lead.id}
              href={`/dashboard/leads/${lead.id}`}
              className="block rounded-lg border bg-card p-4 transition-all hover:shadow-md active:scale-[0.98]"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold">{lead.homeownerName}</h3>
                  <p className="text-sm text-muted-foreground">{lead.homeownerEmail}</p>
                </div>
                <StatusBadge status={lead.status} size="sm" />
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trade Type</span>
                  <span className="font-medium">{lead.tradeType}</span>
                </div>

                {lead.score !== null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lead Score</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full ${
                            lead.score >= 70
                              ? 'bg-green-500'
                              : lead.score >= 40
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                          }`}
                          style={{ width: `${lead.score}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium">{Math.round(lead.score)}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Photos</span>
                  <span className="font-medium">{lead.photos.length}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">
                    {new Date(lead.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
