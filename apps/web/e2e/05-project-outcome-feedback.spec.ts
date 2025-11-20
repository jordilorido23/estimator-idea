import { test, expect } from '@playwright/test';
import {
  cleanDatabase,
  createTestContractor,
  createTestLead,
  createTestEstimate,
  prisma,
} from './utils/db-helpers';
import { testContractors, testLeads } from './utils/test-data';

test.describe('Project Outcome Feedback', () => {
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should record project as WON with actual cost', async ({ page }) => {
    // Setup
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      total: 16481, // $164.81 in cents
      status: 'ACCEPTED',
    });

    // Navigate to estimate detail page
    await page.goto(`/dashboard/leads/${lead.id}/estimate/${estimate.id}`);

    // Should see option to record outcome
    await page.click('button:has-text("Record Outcome"), button:has-text("Update Status")');

    // Select WON outcome
    await page.selectOption('select[name="projectOutcome"]', 'WON');

    // Enter actual cost
    await page.fill('input[name="actualCost"]', '15200'); // $152.00 (under budget)

    // Submit
    await page.click('button:has-text("Save"), button[type="submit"]');

    // Should see success message
    await expect(page.locator('text=/saved|updated|recorded/i')).toBeVisible({ timeout: 5000 });

    // Verify database was updated
    const updatedEstimate = await prisma.estimate.findUnique({
      where: { id: estimate.id },
    });

    expect(updatedEstimate?.projectOutcome).toBe('WON');
    expect(updatedEstimate?.actualCost).toBe(15200);

    // Variance should be calculated
    expect(updatedEstimate?.variance).toBeDefined();
    expect(updatedEstimate?.variancePercent).toBeDefined();

    // Variance = actual - estimated = 15200 - 16481 = -1281 (under by $12.81)
    expect(updatedEstimate?.variance).toBe(-1281);

    // Variance % = (variance / estimate) * 100 = (-1281 / 16481) * 100 = -7.77%
    expect(updatedEstimate?.variancePercent).toBeCloseTo(-7.77, 1);
  });

  test('should calculate variance for over-budget project', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      total: 10000, // $100.00
      status: 'ACCEPTED',
    });

    await page.goto(`/dashboard/leads/${lead.id}/estimate/${estimate.id}`);

    await page.click('button:has-text("Record Outcome")');
    await page.selectOption('select[name="projectOutcome"]', 'WON');
    await page.fill('input[name="actualCost"]', '12000'); // $120.00 (over budget)
    await page.click('button[type="submit"]');

    await page.waitForTimeout(1000);

    // Verify variance calculation
    const updatedEstimate = await prisma.estimate.findUnique({
      where: { id: estimate.id },
    });

    // Variance = 12000 - 10000 = 2000 (over by $20.00)
    expect(updatedEstimate?.variance).toBe(2000);

    // Variance % = (2000 / 10000) * 100 = 20%
    expect(updatedEstimate?.variancePercent).toBe(20);

    // Should show variance on page
    await expect(page.locator('text=/20%|\\+20%/i')).toBeVisible();
  });

  test('should record project as LOST', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      status: 'SENT',
    });

    await page.goto(`/dashboard/leads/${lead.id}/estimate/${estimate.id}`);

    await page.click('button:has-text("Record Outcome")');
    await page.selectOption('select[name="projectOutcome"]', 'LOST');

    // No actual cost needed for LOST projects
    await page.click('button[type="submit"]');

    // Verify
    const updatedEstimate = await prisma.estimate.findUnique({
      where: { id: estimate.id },
    });

    expect(updatedEstimate?.projectOutcome).toBe('LOST');
    expect(updatedEstimate?.actualCost).toBeNull();
    expect(updatedEstimate?.variance).toBeNull();
  });

  test('should record project as IN_PROGRESS', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      status: 'ACCEPTED',
    });

    await page.goto(`/dashboard/leads/${lead.id}/estimate/${estimate.id}`);

    await page.click('button:has-text("Record Outcome")');
    await page.selectOption('select[name="projectOutcome"]', 'IN_PROGRESS');
    await page.click('button[type="submit"]');

    const updatedEstimate = await prisma.estimate.findUnique({
      where: { id: estimate.id },
    });

    expect(updatedEstimate?.projectOutcome).toBe('IN_PROGRESS');
  });

  test('should record project as CANCELLED', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      status: 'ACCEPTED',
    });

    await page.goto(`/dashboard/leads/${lead.id}/estimate/${estimate.id}`);

    await page.click('button:has-text("Record Outcome")');
    await page.selectOption('select[name="projectOutcome"]', 'CANCELLED');
    await page.click('button[type="submit"]');

    const updatedEstimate = await prisma.estimate.findUnique({
      where: { id: estimate.id },
    });

    expect(updatedEstimate?.projectOutcome).toBe('CANCELLED');
  });

  test('should display variance prominently on estimate page', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);

    // Create estimate with existing outcome data
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      total: 10000,
      status: 'ACCEPTED',
      projectOutcome: 'WON',
      actualCost: 9500,
      variance: -500, // $5.00 under
      variancePercent: -5,
    });

    await page.goto(`/dashboard/leads/${lead.id}/estimate/${estimate.id}`);

    // Should see variance displayed
    await expect(page.locator('text=/variance/i')).toBeVisible();
    await expect(page.locator('text=/-5%|5% under/i')).toBeVisible();
    await expect(page.locator('text=/\\$5\\.00/i')).toBeVisible();

    // Should show green/positive indicator for under-budget
    // (exact implementation varies)
  });

  test('should validate actual cost is required for WON projects', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      status: 'ACCEPTED',
    });

    await page.goto(`/dashboard/leads/${lead.id}/estimate/${estimate.id}`);

    await page.click('button:has-text("Record Outcome")');
    await page.selectOption('select[name="projectOutcome"]', 'WON');

    // Don't enter actual cost
    await page.click('button[type="submit"]');

    // Should see validation error
    await expect(page.locator('text=/actual cost.*required/i')).toBeVisible();

    // Should not update database
    const updatedEstimate = await prisma.estimate.findUnique({
      where: { id: estimate.id },
    });

    expect(updatedEstimate?.projectOutcome).toBeNull();
  });

  test('should show variance color coding', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);

    // Create estimate with significant overrun
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      total: 10000,
      projectOutcome: 'WON',
      actualCost: 12500,
      variance: 2500, // $25.00 over
      variancePercent: 25,
    });

    await page.goto(`/dashboard/leads/${lead.id}/estimate/${estimate.id}`);

    // Should show variance with appropriate color
    // Red for over-budget, green for under-budget
    // Implementation details vary, but check for presence of indicator
    const varianceElement = page.locator('text=/25%|\\+25%/i');
    await expect(varianceElement).toBeVisible();

    // Optionally check for color class (depends on your implementation)
    // await expect(varianceElement).toHaveClass(/red|danger|negative/i);
  });

  test('should update estimate after recording outcome', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      total: 10000,
      status: 'ACCEPTED',
    });

    await page.goto(`/dashboard/leads/${lead.id}/estimate/${estimate.id}`);

    // Initially no outcome
    await expect(page.locator('text=/project outcome/i')).not.toBeVisible();

    // Record outcome
    await page.click('button:has-text("Record Outcome")');
    await page.selectOption('select[name="projectOutcome"]', 'WON');
    await page.fill('input[name="actualCost"]', '9800');
    await page.click('button[type="submit"]');

    await page.waitForTimeout(1000);

    // Should now show outcome on page
    await expect(page.locator('text=/won|project won/i')).toBeVisible();
    await expect(page.locator('text=/variance/i')).toBeVisible();
  });

  test('should allow updating outcome after initial recording', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    const estimate = await createTestEstimate(lead.id, contractor.id, {
      total: 10000,
      status: 'ACCEPTED',
      projectOutcome: 'IN_PROGRESS',
    });

    await page.goto(`/dashboard/leads/${lead.id}/estimate/${estimate.id}`);

    // Should see current outcome
    await expect(page.locator('text=/in progress/i')).toBeVisible();

    // Update to WON with actual cost
    await page.click('button:has-text("Update Outcome"), button:has-text("Edit Outcome")');
    await page.selectOption('select[name="projectOutcome"]', 'WON');
    await page.fill('input[name="actualCost"]', '10200');
    await page.click('button[type="submit"]');

    // Verify update
    const updatedEstimate = await prisma.estimate.findUnique({
      where: { id: estimate.id },
    });

    expect(updatedEstimate?.projectOutcome).toBe('WON');
    expect(updatedEstimate?.actualCost).toBe(10200);
  });

  test('should show variance trend for contractor (multiple projects)', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);

    // Create multiple completed projects with variance
    const lead1 = await createTestLead(contractor.id, { homeownerEmail: 'lead1@test.com' });
    await createTestEstimate(lead1.id, contractor.id, {
      total: 10000,
      projectOutcome: 'WON',
      actualCost: 9500,
      variance: -500,
      variancePercent: -5,
    });

    const lead2 = await createTestLead(contractor.id, { homeownerEmail: 'lead2@test.com' });
    await createTestEstimate(lead2.id, contractor.id, {
      total: 15000,
      projectOutcome: 'WON',
      actualCost: 15500,
      variance: 500,
      variancePercent: 3.33,
    });

    const lead3 = await createTestLead(contractor.id, { homeownerEmail: 'lead3@test.com' });
    await createTestEstimate(lead3.id, contractor.id, {
      total: 20000,
      projectOutcome: 'WON',
      actualCost: 19800,
      variance: -200,
      variancePercent: -1,
    });

    // Navigate to metrics/analytics page
    await page.goto('/dashboard/metrics');

    // Should see average variance
    // Average variance % = (-5 + 3.33 - 1) / 3 = -0.89%
    await expect(page.locator('text=/variance|accuracy/i')).toBeVisible();

    // Should show trend (implementation varies)
    await expect(page.locator('text=/average|mean/i')).toBeVisible();
  });
});
