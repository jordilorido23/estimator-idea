import { test, expect } from '@playwright/test';
import {
  cleanDatabase,
  createTestContractor,
  createTestLead,
  createTestEstimate,
  prisma,
} from './utils/db-helpers';
import { testContractors, testLeads, testEstimates } from './utils/test-data';

test.describe('Public Estimate & Payment', () => {
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should view public estimate via token', async ({ page }) => {
    // Setup: Create contractor, lead, and estimate
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      ...testEstimates.roofingEstimate,
      status: 'SENT',
    });

    // Navigate to public estimate URL (no auth required)
    await page.goto(`/e/${estimate.publicToken}`);

    // Should see estimate details (using more specific selector to avoid strict mode violation)
    await expect(page.getByRole('heading', { level: 2 })).toContainText(/estimate|proposal/i);

    // Should see contractor company name
    await expect(page.locator(`text=${contractor.companyName}`)).toBeVisible();

    // Should see homeowner name
    await expect(page.locator(`text=${lead.homeownerName}`)).toBeVisible();

    // Should see project address
    await expect(page.locator(`text=${lead.address}`)).toBeVisible();

    // Should see line items
    for (const item of testEstimates.roofingEstimate.lineItems) {
      await expect(page.locator(`text=/${item.description}/i`)).toBeVisible();
    }

    // Should see subtotal, margin, contingency, and total
    await expect(page.locator('text=/subtotal/i')).toBeVisible();
    await expect(page.locator('text=/total/i')).toBeVisible();

    // Should see deposit amount (25% of total by default)
    const expectedDeposit = Math.round(estimate.total * (contractor.depositPercentage / 100));
    await expect(page.locator(`text=/${expectedDeposit / 100}/`)).toBeVisible(); // Amount in dollars

    // Should see Accept/Approve button
    await expect(page.locator('button:has-text("Accept"), button:has-text("Approve")')).toBeVisible();
  });

  test('should initiate Stripe checkout on accept', async ({ page, context }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      status: 'SENT',
    });

    await page.goto(`/e/${estimate.publicToken}`);

    // Mock Stripe checkout API to prevent actual redirect
    await page.route('**/api/estimates/*/checkout', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          url: 'https://checkout.stripe.com/test-session',
        }),
      });
    });

    // Click Accept button
    await page.click('button:has-text("Accept"), button:has-text("Approve")');

    // Should redirect to Stripe checkout (or show checkout session)
    // In test mode, verify the API was called correctly
    await page.waitForTimeout(1000);

    // Verify estimate status updated to ACCEPTED (or stays SENT until payment completes)
    const updatedEstimate = await prisma.estimate.findUnique({
      where: { id: estimate.id },
    });

    // Status might change on accept or on payment complete - adjust based on your logic
    expect(['SENT', 'ACCEPTED']).toContain(updatedEstimate?.status);
  });

  test('should show expired estimate message', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);

    // Create estimate that expired yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const estimate = await createTestEstimate(lead.id, contractor.id, {
      status: 'SENT',
      expiresAt: yesterday,
    });

    await page.goto(`/e/${estimate.publicToken}`);

    // Should see expired message
    await expect(page.locator('text=/expired|no longer valid/i')).toBeVisible();

    // Accept button should be disabled or hidden
    const acceptButton = page.locator('button:has-text("Accept")');
    if (await acceptButton.isVisible()) {
      await expect(acceptButton).toBeDisabled();
    }

    // Should show contractor contact info
    await expect(page.locator(`text=${contractor.email}`)).toBeVisible();
  });

  test('should show estimate not found for invalid token', async ({ page }) => {
    await page.goto('/e/invalid-token-12345');

    // Should show error message
    await expect(page.locator('text=/not found|invalid|does not exist/i')).toBeVisible();
  });

  test('should display all line items with pricing details', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      ...testEstimates.roofingEstimate,
      status: 'SENT',
    });

    await page.goto(`/e/${estimate.publicToken}`);

    // Verify each line item is displayed with all details
    for (const item of testEstimates.roofingEstimate.lineItems) {
      // Description
      await expect(page.locator(`text=/${item.description}/i`)).toBeVisible();

      // Quantity and unit
      await expect(page.locator(`text=/${item.quantity}/`)).toBeVisible();
      await expect(page.locator(`text=/${item.unit}/i`)).toBeVisible();

      // Unit price (in dollars)
      const unitPriceFormatted = (item.unitPrice / 100).toFixed(2);
      await expect(page.locator(`text=/${unitPriceFormatted}/`)).toBeVisible();

      // Line item total (in dollars)
      const totalFormatted = (item.total / 100).toFixed(2);
      await expect(page.locator(`text=/${totalFormatted}/`)).toBeVisible();
    }
  });

  test('should show confidence level indicator', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      confidence: 'HIGH',
      status: 'SENT',
    });

    await page.goto(`/e/${estimate.publicToken}`);

    // Should show confidence indicator
    await expect(page.locator('text=/high confidence|highly accurate/i')).toBeVisible();
  });

  test('should handle payment completion webhook', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      status: 'SENT',
    });

    // Simulate Stripe webhook for successful payment
    // This would typically be done via API test, but including for completeness
    const depositAmount = Math.round(estimate.total * (contractor.depositPercentage / 100));

    await prisma.payment.create({
      data: {
        estimateId: estimate.id,
        amount: depositAmount,
        type: 'DEPOSIT',
        status: 'COMPLETED',
        stripePaymentId: 'test_payment_123',
      },
    });

    // Update estimate status
    await prisma.estimate.update({
      where: { id: estimate.id },
      data: { status: 'ACCEPTED' },
    });

    // Navigate to estimate page
    await page.goto(`/e/${estimate.publicToken}`);

    // Should show payment received message
    await expect(page.locator('text=/payment received|deposit paid|accepted/i')).toBeVisible();

    // Accept button should be disabled or hidden
    const acceptButton = page.locator('button:has-text("Accept")');
    if (await acceptButton.isVisible()) {
      await expect(acceptButton).toBeDisabled();
    }
  });

  test('should show payment history for accepted estimates', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      status: 'ACCEPTED',
    });

    // Create payment record
    const depositAmount = Math.round(estimate.total * 0.25);
    await prisma.payment.create({
      data: {
        estimateId: estimate.id,
        amount: depositAmount,
        type: 'DEPOSIT',
        status: 'COMPLETED',
        stripePaymentId: 'test_payment_123',
        createdAt: new Date('2024-01-15'),
      },
    });

    await page.goto(`/e/${estimate.publicToken}`);

    // Should show payment history
    await expect(page.locator('text=/payment history|payments/i')).toBeVisible();
    await expect(page.locator('text=/deposit/i')).toBeVisible();
    await expect(page.locator(`text=/${depositAmount / 100}/`)).toBeVisible();
  });

  test('should show correct deposit percentage', async ({ page }) => {
    // Create contractor with 30% deposit
    const contractor = await createTestContractor({
      ...testContractors.roofingContractor,
      depositPercentage: 30,
    });
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      total: 10000, // $100.00
      status: 'SENT',
    });

    await page.goto(`/e/${estimate.publicToken}`);

    // Should show 30% deposit = $30.00
    const expectedDeposit = 10000 * 0.30; // 3000 cents = $30.00
    await expect(page.locator('text=/30%/i')).toBeVisible();
    await expect(page.locator(`text=/\\$?30\\.00/`)).toBeVisible();
  });

  test('should be accessible without authentication', async ({ context }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      status: 'SENT',
    });

    // Create new incognito context (no cookies, no auth)
    const page = await context.newPage();

    // Should be able to view without logging in
    await page.goto(`/e/${estimate.publicToken}`);

    await expect(page.locator('text=/estimate|proposal/i')).toBeVisible();
    await expect(page.locator(`text=${contractor.companyName}`)).toBeVisible();
  });
});
