import type { Metadata } from 'next';
// TEMPORARY: Clerk disabled for demo
// import { ClerkProvider } from '@clerk/nextjs';
import { Inter } from 'next/font/google';

import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'ScopeGuard | AI Preconstruction & Estimating for Residential Contractors',
  description: 'Centralize homeowner intake, automate takeoffs, and close projects faster with AI copilots built for busy contractors.',
  metadataBase: new URL('https://scopeguard.app'),
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    viewportFit: 'cover'
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' }
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ScopeGuard'
  },
  formatDetection: {
    telephone: true,
    date: true,
    address: true,
    email: true
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://scopeguard.app',
    siteName: 'ScopeGuard',
    title: 'ScopeGuard | AI Preconstruction & Estimating',
    description: 'Centralize homeowner intake, automate takeoffs, and close projects faster with AI copilots built for busy contractors.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ScopeGuard | AI Preconstruction & Estimating',
    description: 'Centralize homeowner intake, automate takeoffs, and close projects faster with AI copilots built for busy contractors.',
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
