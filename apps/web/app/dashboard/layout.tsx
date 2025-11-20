// TEMPORARY: Auth disabled for demo
// import { auth } from '@clerk/nextjs/server';
// import { redirect } from 'next/navigation';
import { prisma } from '@scopeguard/db';
import Link from 'next/link';
import { MobileNav } from '@/components/mobile-nav';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { DesktopSidebar } from '@/components/desktop-sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TEMPORARY: Skip auth, use first contractor for demo
  const contractorUser = await prisma.contractorUser.findFirst({
    include: {
      contractor: {
        select: {
          id: true,
          companyName: true,
          slug: true,
        },
      },
    },
  });

  if (!contractorUser) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">No Contractor Account Found</h1>
          <p className="mt-2 text-muted-foreground">
            You need to create a contractor account in your database first.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Run: <code className="rounded bg-muted px-2 py-1">pnpm db:seed</code>
          </p>
        </div>
      </div>
    );
  }

  const userEmail = 'demo@scopeguard.com'; // Mock email for demo

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Mobile Navigation */}
      <MobileNav
        companyName={contractorUser.contractor.companyName}
        companySlug={contractorUser.contractor.slug}
        userEmail={userEmail}
      />

      {/* Desktop Sidebar */}
      <DesktopSidebar
        companyName={contractorUser.contractor.companyName}
        companySlug={contractorUser.contractor.slug}
        userEmail={userEmail}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Desktop Header */}
        <header className="hidden h-16 items-center justify-between border-b px-6 lg:flex">
          <h1 className="text-xl font-semibold">{contractorUser.contractor.companyName}</h1>
          <div className="flex items-center gap-4">
            <Link
              href={`/intake/${contractorUser.contractor.slug}`}
              target="_blank"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              View Intake Form
            </Link>
          </div>
        </header>

        {/* Content area with mobile-friendly padding */}
        <main className="flex-1 p-4 pb-20 lg:p-6 lg:pb-6">{children}</main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}
