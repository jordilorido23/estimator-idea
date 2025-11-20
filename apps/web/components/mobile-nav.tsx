'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ClipboardList, DollarSign, TrendingUp, Settings, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileNavProps {
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

export function MobileNav({ companyName, companySlug, userEmail }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background px-4 lg:hidden">
        <Link href="/dashboard" className="text-lg font-semibold">
          ScopeGuard
        </Link>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-accent"
          aria-label="Toggle menu"
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </header>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 transform border-r bg-background transition-transform duration-300 ease-in-out lg:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center border-b px-6">
          <Link
            href="/dashboard"
            className="text-lg font-semibold"
            onClick={() => setIsOpen(false)}
          >
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
                onClick={() => setIsOpen(false)}
                className={cn(
                  'flex items-center rounded-lg px-3 py-3 text-sm font-medium transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  'min-h-[44px]', // Minimum touch target size
                  isActive(item.href)
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground'
                )}
              >
                <Icon className="mr-3 h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Company Info */}
        <div className="absolute bottom-0 w-full border-t bg-muted/30 p-4">
          <div className="text-sm">
            <div className="font-medium">{companyName}</div>
            <div className="text-xs text-muted-foreground">{userEmail}</div>
          </div>
          <Link
            href={`/intake/${companySlug}`}
            target="_blank"
            onClick={() => setIsOpen(false)}
            className="mt-3 inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            View Intake Form
          </Link>
        </div>
      </aside>
    </>
  );
}
