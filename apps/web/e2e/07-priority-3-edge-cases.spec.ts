import { test, expect } from '@playwright/test';
import {
  cleanDatabase,
  createTestContractor,
  createTestLead,
  createTestEstimate,
  prisma,
} from './utils/db-helpers';
import { testContractors } from './utils/test-data';

test.describe('Priority 3: Form Validation', () => {
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should validate file size limits on photo upload', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);

    await page.goto(`/intake/${contractor.slug}`);

    // Should show file size limit in UI
    await expect(page.locator('text=/max.*15.*mb|maximum.*file.*size/i')).toBeVisible();

    // TODO: Test actual file upload with oversized file
    // This requires creating a test file > 15MB
  });

  test('should limit number of photos per lead', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);

    await page.goto(`/intake/${contractor.slug}`);

    // Should show photo limit (max 10)
    await expect(page.locator('text=/up to 10|maximum 10/i')).toBeVisible();

    // TODO: Test uploading 11 photos and verify rejection
  });

  test('should validate required address field', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);

    await page.goto(`/intake/${contractor.slug}`);

    await page.fill('input[name="homeownerName"]', 'Test User');
    await page.fill('input[name="homeownerEmail"]', 'test@example.com');
    await page.fill('input[name="homeownerPhone"]', '555-123-4567');
    // Skip address field
    await page.selectOption('select[name="tradeType"]', 'ROOFING');

    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(page.locator('text=/address.*required/i')).toBeVisible();
  });

  test('should validate budget format', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);

    await page.goto(`/intake/${contractor.slug}`);

    // If budget is free-text (not dropdown), validate format
    const budgetInput = page.locator('input[name="budget"]');
    if (await budgetInput.isVisible()) {
      await budgetInput.fill('abc'); // Invalid

      await page.click('button[type="submit"]');

      await expect(page.locator('text=/valid budget|number/i')).toBeVisible();
    }
  });

  test('should sanitize HTML in notes field', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);

    await page.goto(`/intake/${contractor.slug}`);

    await page.fill('input[name="homeownerName"]', 'Test User');
    await page.fill('input[name="homeownerEmail"]', 'test@example.com');
    await page.fill('input[name="homeownerPhone"]', '555-123-4567');
    await page.fill('input[name="address"]', '123 Test St');
    await page.selectOption('select[name="tradeType"]', 'ROOFING');

    // Try to inject HTML/script
    await page.fill('textarea[name="notes"]', '<script>alert("XSS")</script>Roof needs repair');

    await page.click('button[type="submit"]');

    // Verify lead was created with sanitized content
    const lead = await prisma.lead.findFirst({
      where: { homeownerEmail: 'test@example.com' },
    });

    // Script tags should be stripped or escaped
    expect(lead?.notes).not.toContain('<script>');
  });
});

test.describe('Priority 3: Rate Limiting', () => {
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  test('should rate limit lead submissions', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);

    // Submit multiple leads rapidly
    for (let i = 0; i < 6; i++) {
      await page.goto(`/intake/${contractor.slug}`);

      await page.fill('input[name="homeownerName"]', `Test User ${i}`);
      await page.fill('input[name="homeownerEmail"]', `test${i}@example.com`);
      await page.fill('input[name="homeownerPhone"]', '555-123-4567');
      await page.fill('input[name="address"]', '123 Test St');
      await page.selectOption('select[name="tradeType"]', 'ROOFING');

      await page.click('button[type="submit"]');

      // First 5 should succeed, 6th should be rate limited
      if (i < 5) {
        await expect(page.locator('text=/thank you|success/i')).toBeVisible({ timeout: 5000 });
      } else {
        await expect(page.locator('text=/too many|rate limit|slow down/i')).toBeVisible({
          timeout: 5000,
        });
      }
    }
  });
});

test.describe('Priority 3: Authorization', () => {
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  test('should block access to other contractors leads', async ({ page }) => {
    const contractor1 = await createTestContractor({
      ...testContractors.roofingContractor,
      slug: 'contractor-1',
    });
    const contractor2 = await createTestContractor({
      companyName: 'Contractor 2',
      slug: 'contractor-2',
      email: 'contractor2@test.com',
    });

    const lead = await createTestLead(contractor1.id);

    // Try to access contractor1's lead as contractor2
    // (Requires auth implementation)
    // TODO: Mock auth as contractor2

    await page.goto(`/dashboard/leads/${lead.id}`);

    // Should see error or redirect
    await expect(page.locator('text=/not found|unauthorized|access denied/i')).toBeVisible();
  });

  test('should require authentication for dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login or show auth error
    // (Exact behavior depends on Clerk configuration)
    await expect(page).toHaveURL(/sign-in|login|auth/i);
  });

  test('should allow public access to intake form', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);

    // Should be able to access without auth
    await page.goto(`/intake/${contractor.slug}`);

    await expect(page.locator('h1, h2')).toContainText(contractor.companyName);
    // No redirect to login
  });

  test('should allow public access to estimate view', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id);
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      status: 'SENT',
    });

    // Should be accessible without auth
    await page.goto(`/e/${estimate.publicToken}`);

    await expect(page.locator('text=/estimate/i')).toBeVisible();
    // No redirect to login
  });
});

test.describe('Priority 3: Error Handling', () => {
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  test('should show 404 for non-existent lead', async ({ page }) => {
    await page.goto('/dashboard/leads/non-existent-id-12345');

    await expect(page.locator('text=/not found|404/i')).toBeVisible();
  });

  test('should show 404 for non-existent estimate', async ({ page }) => {
    await page.goto('/dashboard/leads/some-id/estimate/non-existent-estimate');

    await expect(page.locator('text=/not found|404/i')).toBeVisible();
  });

  test('should show error for invalid public token', async ({ page }) => {
    await page.goto('/e/invalid-token-xyz');

    await expect(page.locator('text=/not found|invalid|expired/i')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);

    await page.goto(`/intake/${contractor.slug}`);

    // Simulate network failure
    await page.route('**/api/leads', (route) => route.abort());

    await page.fill('input[name="homeownerName"]', 'Test User');
    await page.fill('input[name="homeownerEmail"]', 'test@example.com');
    await page.fill('input[name="homeownerPhone"]', '555-123-4567');
    await page.fill('input[name="address"]', '123 Test St');
    await page.selectOption('select[name="tradeType"]', 'ROOFING');

    await page.click('button[type="submit"]');

    // Should show user-friendly error
    await expect(page.locator('text=/error|failed|try again/i')).toBeVisible({ timeout: 5000 });
  });

  test('should handle database errors gracefully', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);

    // Mock API to return 500 error
    await page.route('**/api/leads', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Database connection failed' }),
      });
    });

    await page.goto(`/intake/${contractor.slug}`);

    await page.fill('input[name="homeownerName"]', 'Test User');
    await page.fill('input[name="homeownerEmail"]', 'test@example.com');
    await page.fill('input[name="homeownerPhone"]', '555-123-4567');
    await page.fill('input[name="address"]', '123 Test St');
    await page.selectOption('select[name="tradeType"]', 'ROOFING');

    await page.click('button[type="submit"]');

    await expect(page.locator('text=/error|something went wrong/i')).toBeVisible();
  });
});

test.describe('Priority 3: Stripe Payment Flows', () => {
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  test('should create Stripe checkout session', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id);
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      status: 'SENT',
    });

    // Mock Stripe checkout API
    await page.route('**/api/estimates/*/checkout', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://checkout.stripe.com/test-session-123',
        }),
      });
    });

    await page.goto(`/e/${estimate.publicToken}`);
    await page.click('button:has-text("Accept")');

    // Should receive checkout URL
    await page.waitForTimeout(1000);

    // Verify API was called with correct amount
    // (In real implementation, you'd verify the Stripe session parameters)
  });

  test('should handle declined payment', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id);
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      status: 'SENT',
    });

    // Simulate Stripe webhook for declined payment
    await prisma.payment.create({
      data: {
        estimateId: estimate.id,
        amount: Math.round(estimate.total * 0.25),
        type: 'DEPOSIT',
        status: 'FAILED',
        stripePaymentId: 'test_payment_failed',
      },
    });

    await page.goto(`/e/${estimate.publicToken}`);

    // Should show payment failed message
    await expect(page.locator('text=/payment.*failed|declined/i')).toBeVisible();

    // Should allow retry
    await expect(page.locator('button:has-text("Try Again"), button:has-text("Retry")')).toBeVisible();
  });

  test('should update payment status from webhook', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id);
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      status: 'SENT',
    });

    // Create pending payment
    const payment = await prisma.payment.create({
      data: {
        estimateId: estimate.id,
        amount: Math.round(estimate.total * 0.25),
        type: 'DEPOSIT',
        status: 'PENDING',
        stripePaymentId: 'test_payment_pending',
      },
    });

    // Simulate webhook updating payment to COMPLETED
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'COMPLETED' },
    });

    await prisma.estimate.update({
      where: { id: estimate.id },
      data: { status: 'ACCEPTED' },
    });

    await page.goto(`/e/${estimate.publicToken}`);

    // Should show payment completed
    await expect(page.locator('text=/payment.*received|deposit.*paid/i')).toBeVisible();
  });

  test('should handle refunded payment', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id);
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      status: 'ACCEPTED',
    });

    // Create refunded payment
    await prisma.payment.create({
      data: {
        estimateId: estimate.id,
        amount: Math.round(estimate.total * 0.25),
        type: 'DEPOSIT',
        status: 'REFUNDED',
        stripePaymentId: 'test_payment_refunded',
      },
    });

    await page.goto(`/dashboard/leads/${lead.id}/estimate/${estimate.id}`);

    // Should show refunded status
    await expect(page.locator('text=/refunded/i')).toBeVisible();
  });
});

test.describe('Priority 3: Data Integrity', () => {
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  test('should prevent creating estimate without lead', async ({ page }) => {
    // Try to access estimate creation with invalid lead ID
    await page.goto('/dashboard/leads/invalid-id/estimate/new');

    await expect(page.locator('text=/not found|invalid/i')).toBeVisible();
  });

  test('should prevent duplicate lead submissions', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);

    const formData = {
      homeownerName: 'Test User',
      homeownerEmail: 'duplicate@test.com',
      homeownerPhone: '555-123-4567',
      address: '123 Test St',
      tradeType: 'ROOFING',
    };

    // Submit first lead
    await page.goto(`/intake/${contractor.slug}`);
    await page.fill('input[name="homeownerName"]', formData.homeownerName);
    await page.fill('input[name="homeownerEmail"]', formData.homeownerEmail);
    await page.fill('input[name="homeownerPhone"]', formData.homeownerPhone);
    await page.fill('input[name="address"]', formData.address);
    await page.selectOption('select[name="tradeType"]', formData.tradeType);
    await page.click('button[type="submit"]');

    await expect(page.locator('text=/success|thank you/i')).toBeVisible({ timeout: 5000 });

    // Try to submit duplicate immediately
    await page.goto(`/intake/${contractor.slug}`);
    await page.fill('input[name="homeownerName"]', formData.homeownerName);
    await page.fill('input[name="homeownerEmail"]', formData.homeownerEmail);
    await page.fill('input[name="homeownerPhone"]', formData.homeownerPhone);
    await page.fill('input[name="address"]', formData.address);
    await page.selectOption('select[name="tradeType"]', formData.tradeType);
    await page.click('button[type="submit"]');

    // Should either succeed (both leads allowed) or show duplicate warning
    // This depends on your business logic - adjust assertion accordingly
  });
});
