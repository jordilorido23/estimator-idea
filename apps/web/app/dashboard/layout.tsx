import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@scopeguard/db';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  // Find contractor user by Clerk user ID (email)
  const user = await auth();
  const userEmail = user.sessionClaims?.email as string | undefined;

  if (!userEmail) {
    redirect('/sign-in');
  }

  const contractorUser = await prisma.contractorUser.findUnique({
    where: { email: userEmail },
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
            Your email is not associated with any contractor account.
          </p>
          <p className="mt-4 text-sm">
            Contact support if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/30">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/dashboard" className="text-lg font-semibold">
            ScopeGuard
          </Link>
        </div>

        <nav className="space-y-1 p-4">
          <Link
            href="/dashboard"
            className="flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <span className="mr-3">📊</span>
            Dashboard
          </Link>

          <Link
            href="/dashboard/leads"
            className="flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <span className="mr-3">📋</span>
            Leads
          </Link>

          <Link
            href="/dashboard/estimates"
            className="flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <span className="mr-3">💰</span>
            Estimates
          </Link>

          <Link
            href="/dashboard/settings"
            className="flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <span className="mr-3">⚙️</span>
            Settings
          </Link>
        </nav>

        <div className="absolute bottom-0 w-64 border-t p-4">
          <div className="text-sm">
            <div className="font-medium">{contractorUser.contractor.companyName}</div>
            <div className="text-xs text-muted-foreground">{userEmail}</div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1">
        <header className="flex h-16 items-center justify-between border-b px-6">
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

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
