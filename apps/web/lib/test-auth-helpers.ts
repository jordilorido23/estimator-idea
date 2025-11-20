/**
 * Test Auth Helpers
 *
 * Provides mock authentication for e2e tests when E2E_BYPASS_AUTH=true
 */

import { auth } from '@clerk/nextjs/server';

export type MockAuthResult = {
  userId: string | null;
  sessionClaims?: {
    email?: string;
    [key: string]: any;
  };
};

/**
 * Mock user for e2e tests
 * This email should match a ContractorUser created in test setup
 */
const E2E_TEST_USER = {
  userId: 'test-user-id',
  email: 'test@contractor.com',
};

/**
 * Check if we're in e2e test mode
 */
export function isE2ETestMode(): boolean {
  return (
    process.env.E2E_BYPASS_AUTH === 'true' &&
    process.env.NODE_ENV !== 'production'
  );
}

/**
 * Get auth data - returns mock data in e2e mode, real auth otherwise
 */
export async function getAuth(): Promise<MockAuthResult> {
  if (isE2ETestMode()) {
    // Return mock auth data for e2e tests
    return {
      userId: E2E_TEST_USER.userId,
      sessionClaims: {
        email: E2E_TEST_USER.email,
      },
    };
  }

  // Use real Clerk auth in production/development
  const clerkAuth = await auth();
  return {
    userId: clerkAuth.userId,
    sessionClaims: clerkAuth.sessionClaims as any,
  };
}

/**
 * Get the authenticated user's ID
 */
export async function getAuthUserId(): Promise<string | null> {
  const authResult = await getAuth();
  return authResult.userId;
}

/**
 * Get the authenticated user's email from session claims
 */
export async function getAuthUserEmail(): Promise<string | undefined> {
  const authResult = await getAuth();
  return authResult.sessionClaims?.email as string | undefined;
}
