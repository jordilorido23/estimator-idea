import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Inter } from 'next/font/google';

import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'ScopeGuard | AI Preconstruction & Estimating for Residential Contractors',
  description: 'Centralize homeowner intake, automate takeoffs, and close projects faster with AI copilots built for busy contractors.',
  metadataBase: new URL('https://scopeguard.app')
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.variable}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
