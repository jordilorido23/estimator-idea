import { test as base, Page } from '@playwright/test';
import { Contractor } from '@scopeguard/db';

/**
 * Mock authentication for Clerk
 *
 * In e2e tests, we bypass Clerk authentication using the E2E_BYPASS_AUTH environment variable.
 * This allows all routes (including protected dashboard routes) to be accessed without authentication.
 *
 * The bypass is enabled in middleware.ts when:
 * - E2E_BYPASS_AUTH=true
 * - NODE_ENV !== 'production'
 *
 * This approach is simpler and more reliable than mocking Clerk sessions.
 */

export type AuthenticatedPage = Page & {
  contractor: Contractor;
};

/**
 * Set up authentication state for a contractor
 *
 * Note: With E2E_BYPASS_AUTH enabled, this function is mostly a no-op.
 * The middleware automatically allows access to all routes during testing.
 *
 * We keep this function for compatibility with existing tests and for
 * future scenarios where we might want to test actual Clerk integration.
 */
export async function loginAsContractor(page: Page, contractor: Contractor): Promise<void> {
  // With E2E_BYPASS_AUTH enabled in middleware, no authentication setup is needed
  // All protected routes are automatically accessible

  // Store contractor context in page for test reference
  await page.evaluate((contractorData) => {
    (window as any).__TEST_CONTRACTOR__ = contractorData;
  }, contractor);

  // Note: If E2E_BYPASS_AUTH is disabled and you need actual authentication,
  // implement Clerk test mode here:
  // 1. Use Clerk's test tokens (if available)
  // 2. Mock Clerk API responses via route interception
  // 3. Set authentication cookies directly
}

/**
 * Extended test fixture with authentication helpers
 */
export const test = base.extend<{
  authenticatedPage: Page;
  contractor: Contractor;
}>({
  contractor: async ({}, use) => {
    // This will be set by tests that need it
    await use({} as Contractor);
  },

  authenticatedPage: async ({ page, contractor }, use) => {
    if (contractor && contractor.id) {
      await loginAsContractor(page, contractor);
    }
    await use(page);
  },
});

export { expect } from '@playwright/test';
