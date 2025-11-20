import Link from 'next/link';
import { LayoutDashboard, ClipboardList, DollarSign, TrendingUp, Settings } from 'lucide-react';

interface DesktopSidebarProps {
  companyName: string;
  companySlug: string;
  userEmail: string;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/leads', label: 'Leads', icon: ClipboardList },
  { href: '/dashboard/estimates', label: 'Estimates', icon: DollarSign },
  { href: '/dashboard/metrics', label: 'Metrics', icon: TrendingUp },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function DesktopSidebar({ companyName, companySlug, userEmail }: DesktopSidebarProps) {

  return (
    <aside className="hidden w-64 border-r bg-muted/30 lg:block">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="text-lg font-semibold">
          ScopeGuard
        </Link>
      </div>

      <nav className="space-y-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Icon className="mr-3 h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-0 w-64 border-t p-4">
        <div className="text-sm">
          <div className="font-medium">{companyName}</div>
          <div className="text-xs text-muted-foreground">{userEmail}</div>
        </div>
        <Link
          href={`/intake/${companySlug}`}
          target="_blank"
          className="mt-3 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          View Intake Form
        </Link>
      </div>
    </aside>
  );
}
