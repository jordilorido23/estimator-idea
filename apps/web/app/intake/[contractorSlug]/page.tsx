import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { prisma } from '@scopeguard/db';

import { IntakeForm } from '@/components/intake-form';

type IntakePageProps = {
  params: {
    contractorSlug: string;
  };
};

const getContractor = cache(async (slug: string) => {
  if (!slug) return null;

  return prisma.contractor.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      companyName: true,
      trades: true
    }
  });
});

export async function generateMetadata({ params }: IntakePageProps): Promise<Metadata> {
  const contractor = await getContractor(params.contractorSlug);

  if (!contractor) {
    return {
      title: 'Lead intake | ScopeGuard'
    };
  }

  return {
    title: `${contractor.companyName} · Lead intake`,
    description: 'Share a few project details to kick off your estimate.'
  };
}

export default async function ContractorIntakePage({ params }: IntakePageProps) {
  const contractor = await getContractor(params.contractorSlug);

  if (!contractor) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">ScopeGuard intake portal</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Start a project with {contractor.companyName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Tell us about your scope, and the team will follow up to schedule a walkthrough and estimate.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border bg-background p-6 shadow-sm sm:p-8">
          <IntakeForm
            contractorSlug={contractor.slug}
            contractorName={contractor.companyName}
            projectTypes={contractor.trades}
          />
        </div>
      </div>
    </main>
  );
}
