import { prisma } from '@scopeguard/db';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@scopeguard/ui';

import { IntakeForm } from '@/components/intake-form';

const features = [
  {
    title: 'AI scope copilots',
    description: 'Summarize homeowner intent, uncover missing scope items, and spin up takeoffs in minutes.'
  },
  {
    title: 'Centralized comms',
    description: 'Every text, photo, and intake note threads into the lead record for the whole team.'
  },
  {
    title: 'Estimate guardrails',
    description: 'Prisma-powered models keep margins, contingency, and approvals on track before the handoff.'
  }
];

const stats = [
  { label: 'Faster proposals', value: '4x' },
  { label: 'Avg. margin lift', value: '+6%' },
  { label: 'Lead response SLA', value: '<5 min' }
];

const fallbackContractor = {
  slug: 'demo-contractor',
  name: 'ScopeGuard Builders',
  projectTypes: ['Kitchen remodel', 'Bathroom remodel', 'ADU or addition']
};

export default async function HomePage() {
  const contractor = await prisma.contractor.findFirst({
    select: {
      slug: true,
      companyName: true,
      trades: true
    }
  });

  const intakeProps = contractor
    ? {
        contractorSlug: contractor.slug,
        contractorName: contractor.companyName,
        projectTypes: contractor.trades
      }
    : {
        contractorSlug: fallbackContractor.slug,
        contractorName: fallbackContractor.name,
        projectTypes: fallbackContractor.projectTypes
      };

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted">
      <section className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-24 lg:flex-row lg:items-center">
        <div className="flex-1 space-y-8">
          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            AI preconstruction OS
          </span>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              ScopeGuard keeps bids sharp and homeowners confident.
            </h1>
            <p className="text-lg text-muted-foreground">
              Intake, estimate, and close residential projects with an AI teammate that understands construction risk, not just chat prompts.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg">Launch dashboard</Button>
            <Button size="lg" variant="secondary">
              Book a live demo
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border bg-card/80 p-4 text-center shadow-sm">
                <p className="text-3xl font-semibold text-primary">{stat.value}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <Card className="border-primary/40 shadow-xl">
            <CardHeader>
              <CardTitle>Accelerated homeowner intake</CardTitle>
              <CardDescription>Kick off a scope conversation in under a minute.</CardDescription>
            </CardHeader>
            <CardContent>
              <IntakeForm {...intakeProps} />
              <p className="mt-4 text-xs text-muted-foreground">
                This starter experience is ready for Clerk auth, S3 uploads, and Stripe plans.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 pb-24 md:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </main>
  );
}
