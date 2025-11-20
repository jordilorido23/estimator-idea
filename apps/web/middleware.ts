import { NextRequest, NextResponse } from 'next/server';
import type { NextMiddleware } from 'next/server';

/**
 * Check if we should bypass auth for e2e tests
 */
const shouldBypassAuth = () => {
  return (
    process.env.E2E_BYPASS_AUTH === 'true' &&
    process.env.NODE_ENV !== 'production'
  );
};

/**
 * Simple passthrough middleware for E2E tests
 */
const e2eMiddleware: NextMiddleware = (req) => {
  return NextResponse.next();
};

/**
 * Production middleware with Clerk authentication
 * Only imported when not in E2E test mode
 */
const createProductionMiddleware = async (): Promise<NextMiddleware> => {
  const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server');

  const isPublicRoute = createRouteMatcher([
    '/',
    '/intake(.*)',
    '/e(.*)',
    '/api/webhooks(.*)',
    '/api/uploads/presign',
    '/api/uploads/presign-document',
    '/api/leads',
    '/api/health',
    '/sign-in(.*)',
    '/sign-up(.*)',
  ]);

  return clerkMiddleware((auth, req) => {
    // Allow public routes without authentication
    if (isPublicRoute(req)) {
      return NextResponse.next();
    }

    // Protect all other routes
    auth().protect();

    return NextResponse.next();
  });
};

// Choose middleware based on environment
// This runs at module load time, so we check the env var BEFORE importing Clerk
let middlewarePromise: Promise<NextMiddleware> | null = null;

const middleware: NextMiddleware = async (req) => {
  // Use simple passthrough for E2E tests
  if (shouldBypassAuth()) {
    return e2eMiddleware(req);
  }

  // Lazy load Clerk middleware only when needed
  if (!middlewarePromise) {
    middlewarePromise = createProductionMiddleware();
  }

  const productionMiddleware = await middlewarePromise;
  return productionMiddleware(req);
};

export default middleware;

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
