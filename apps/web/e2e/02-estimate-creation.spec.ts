import { test, expect } from '@playwright/test';
import {
  cleanDatabase,
  createTestContractor,
  createTestLead,
  createTestTakeoff,
  createTestPhoto,
  prisma,
} from './utils/db-helpers';
import { testContractors, testLeads, testTakeoffs } from './utils/test-data';

test.describe('Estimate Creation', () => {
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should create estimate from AI takeoff', async ({ page }) => {
    // Setup: Create contractor, lead, and AI takeoff
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    await createTestPhoto(lead.id);
    const takeoff = await createTestTakeoff(lead.id, testTakeoffs.roofingTakeoff);

    // Mock authentication (you'll need to implement based on your auth setup)
    // For now, we'll assume there's a test endpoint or auth bypass
    // TODO: Implement proper auth mocking based on Clerk setup

    // Navigate to lead detail page
    await page.goto(`/dashboard/leads/${lead.id}`);

    // Should see the AI takeoff
    await expect(page.locator('text=/scope of work|takeoff/i')).toBeVisible();

    // Should see confidence score
    await expect(page.locator(`text=/88%|0.88/`)).toBeVisible();

    // Click to create new estimate
    await page.click('text=/create estimate|new estimate/i');

    // Should navigate to estimate creation page
    await expect(page).toHaveURL(new RegExp(`/leads/${lead.id}/estimate/new`));

    // AI-generated line items should be pre-filled from takeoff
    await expect(page.locator('text=/tear off|shingles/i')).toBeVisible();

    // Should be able to adjust margin
    const marginInput = page.locator('input[name="margin"]');
    await marginInput.fill('20');

    // Should be able to adjust contingency
    const contingencyInput = page.locator('input[name="contingency"]');
    await contingencyInput.fill('10');

    // Should see total calculation update
    // (Exact amount depends on your calculation logic)

    // Save estimate as draft
    await page.click('button:has-text("Save Draft"), button:has-text("Save as Draft")');

    // Should see success message
    await expect(page.locator('text=/saved|created/i')).toBeVisible({ timeout: 10000 });

    // Verify estimate was created in database
    const estimates = await prisma.estimate.findMany({
      where: { leadId: lead.id },
    });

    expect(estimates).toHaveLength(1);
    const estimate = estimates[0];

    expect(estimate.status).toBe('DRAFT');
    expect(estimate.contractorId).toBe(contractor.id);
    expect(estimate.lineItems).toBeDefined();
    expect(estimate.total).toBeGreaterThan(0);
    expect(estimate.margin).toBeGreaterThan(0);
    expect(estimate.contingency).toBeGreaterThan(0);

    // Should have a public token generated
    expect(estimate.publicToken).toBeTruthy();
  });

  test('should allow adding custom line items', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    await createTestTakeoff(lead.id, testTakeoffs.roofingTakeoff);

    await page.goto(`/dashboard/leads/${lead.id}/estimate/new`);

    // Find and click "Add Line Item" button
    await page.click('button:has-text("Add Line Item"), button:has-text("Add Custom Item")');

    // Fill in custom line item details
    await page.fill('input[name="description"], input[placeholder*="description"]', 'Custom gutter repair');
    await page.fill('input[name="quantity"]', '50');
    await page.fill('input[name="unit"]', 'linear ft');
    await page.fill('input[name="unitPrice"]', '12.50');

    // Total should calculate automatically (50 * 12.50 = 625)
    await expect(page.locator('text=/625|$625/i')).toBeVisible();

    // Save the estimate
    await page.click('button:has-text("Save Draft")');

    // Verify custom line item was saved
    const estimates = await prisma.estimate.findMany({
      where: { leadId: lead.id },
    });

    expect(estimates).toHaveLength(1);
    const lineItems = estimates[0].lineItems as any[];

    const customItem = lineItems.find(item =>
      item.description?.toLowerCase().includes('gutter')
    );
    expect(customItem).toBeDefined();
  });

  test('should allow editing AI-suggested line items', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    await createTestTakeoff(lead.id, testTakeoffs.roofingTakeoff);

    await page.goto(`/dashboard/leads/${lead.id}/estimate/new`);

    // Find first line item and edit its quantity
    const firstQuantityInput = page.locator('input[name*="quantity"]').first();
    await firstQuantityInput.clear();
    await firstQuantityInput.fill('2500'); // Change from 2200 to 2500

    // Total should recalculate
    await page.waitForTimeout(500); // Wait for calculation

    // Save the estimate
    await page.click('button:has-text("Save Draft")');

    // Verify changes were saved
    const estimates = await prisma.estimate.findMany({
      where: { leadId: lead.id },
    });

    const lineItems = estimates[0].lineItems as any[];
    expect(lineItems.some(item => item.quantity === 2500)).toBe(true);
  });

  test('should allow removing line items', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    await createTestTakeoff(lead.id, testTakeoffs.roofingTakeoff);

    await page.goto(`/dashboard/leads/${lead.id}/estimate/new`);

    // Count initial line items
    const initialCount = await page.locator('[data-testid="line-item"], .line-item').count();

    // Remove first line item
    await page.click('button:has-text("Remove"), button[aria-label*="remove"]', { timeout: 5000 });

    // Should have one fewer line item
    const newCount = await page.locator('[data-testid="line-item"], .line-item').count();
    expect(newCount).toBe(initialCount - 1);
  });

  test('should calculate total correctly', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    await createTestTakeoff(lead.id, testTakeoffs.roofingTakeoff);

    await page.goto(`/dashboard/leads/${lead.id}/estimate/new`);

    // Set known values for margin and contingency
    await page.fill('input[name="margin"]', '20');
    await page.fill('input[name="contingency"]', '10');

    // If subtotal is shown, verify it's calculated correctly
    // Total = Subtotal * (1 + margin + contingency)
    // Total = Subtotal * 1.30

    await page.click('button:has-text("Save Draft")');

    // Verify math in database
    const estimate = await prisma.estimate.findFirst({
      where: { leadId: lead.id },
    });

    expect(estimate).toBeDefined();
    const expectedTotal = Math.round(estimate!.subtotal * (1 + estimate!.margin + estimate!.contingency));
    expect(estimate!.total).toBeCloseTo(expectedTotal, 0); // Within $1
  });

  test('should set confidence level based on AI takeoff confidence', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);

    // Create high-confidence takeoff
    await createTestTakeoff(lead.id, {
      ...testTakeoffs.roofingTakeoff,
      confidence: 0.95,
    });

    await page.goto(`/dashboard/leads/${lead.id}/estimate/new`);

    // Should show high confidence indicator
    await expect(page.locator('text=/high confidence/i')).toBeVisible();

    await page.click('button:has-text("Save Draft")');

    // Verify estimate has HIGH confidence
    const estimate = await prisma.estimate.findFirst({
      where: { leadId: lead.id },
    });

    expect(estimate?.confidence).toBe('HIGH');
  });

  test('should require at least one line item', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    await createTestTakeoff(lead.id, testTakeoffs.roofingTakeoff);

    await page.goto(`/dashboard/leads/${lead.id}/estimate/new`);

    // Remove all line items
    const removeButtons = page.locator('button:has-text("Remove")');
    const count = await removeButtons.count();

    for (let i = 0; i < count; i++) {
      await removeButtons.first().click();
      await page.waitForTimeout(200);
    }

    // Try to save with no line items
    await page.click('button:has-text("Save Draft")');

    // Should show validation error
    await expect(page.locator('text=/at least one line item|no line items/i')).toBeVisible();

    // Should not create estimate
    const estimateCount = await prisma.estimate.count({
      where: { leadId: lead.id },
    });
    expect(estimateCount).toBe(0);
  });
});
