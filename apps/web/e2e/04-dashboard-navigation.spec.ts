import { test, expect } from '@playwright/test';
import {
  cleanDatabase,
  createTestContractor,
  createTestLead,
  createTestEstimate,
  createTestPhoto,
  prisma,
} from './utils/db-helpers';
import { testContractors, testLeads } from './utils/test-data';
import { TradeType } from '@scopeguard/db';

test.describe('Dashboard Navigation', () => {
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should display dashboard with summary statistics', async ({ page }) => {
    // Setup: Create contractor and various leads
    const contractor = await createTestContractor(testContractors.multiTradeContractor);

    // Create leads with different statuses
    await createTestLead(contractor.id, { ...testLeads.roofingLead, status: 'NEW' });
    await createTestLead(contractor.id, { ...testLeads.kitchenLead, status: 'NEW' });
    const qualifiedLead = await createTestLead(contractor.id, {
      homeownerName: 'Test Qualified',
      homeownerEmail: 'qualified@test.com',
      status: 'QUALIFIED',
    });
    await createTestLead(contractor.id, {
      homeownerName: 'Test Estimated',
      homeownerEmail: 'estimated@test.com',
      status: 'ESTIMATED',
    });

    // TODO: Mock authentication - implement based on Clerk setup

    // Navigate to dashboard
    await page.goto('/dashboard');

    // Should see summary cards/metrics
    await expect(page.locator('text=/total leads/i')).toBeVisible();
    await expect(page.locator('text=/4/').first()).toBeVisible(); // 4 total leads

    await expect(page.locator('text=/new leads/i')).toBeVisible();
    await expect(page.locator('text=/2/').first()).toBeVisible(); // 2 new leads

    await expect(page.locator('text=/qualified/i')).toBeVisible();
    await expect(page.locator('text=/1/').first()).toBeVisible(); // 1 qualified

    // Should see recent leads list
    await expect(page.locator('text=/recent leads|leads/i')).toBeVisible();
  });

  test('should filter leads by status', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);

    // Create leads with different statuses
    await createTestLead(contractor.id, { ...testLeads.roofingLead, status: 'NEW' });
    await createTestLead(contractor.id, {
      homeownerName: 'Qualified Lead',
      homeownerEmail: 'qualified@test.com',
      status: 'QUALIFIED',
    });
    await createTestLead(contractor.id, {
      homeownerName: 'Estimated Lead',
      homeownerEmail: 'estimated@test.com',
      status: 'ESTIMATED',
    });
    await createTestLead(contractor.id, {
      homeownerName: 'Declined Lead',
      homeownerEmail: 'declined@test.com',
      status: 'DECLINED',
    });

    await page.goto('/dashboard/leads');

    // Initially should see all leads (4 total)
    await expect(page.locator('[data-testid="lead-card"], .lead-item, tr[data-lead]').or(page.locator('text=/Alice Johnson|Qualified Lead|Estimated Lead|Declined Lead/'))).toBeVisible();

    // Filter by NEW status
    await page.click('button:has-text("Filter"), select[name="status"]');
    await page.selectOption('select[name="status"]', 'NEW');
    // Or if using buttons/tabs:
    // await page.click('button:has-text("New")');

    // Should only see NEW leads
    await expect(page.locator('text=/Alice Johnson/i')).toBeVisible();
    await expect(page.locator('text=/Qualified Lead/i')).not.toBeVisible();

    // Filter by QUALIFIED
    await page.selectOption('select[name="status"]', 'QUALIFIED');

    await expect(page.locator('text=/Qualified Lead/i')).toBeVisible();
    await expect(page.locator('text=/Alice Johnson/i')).not.toBeVisible();
  });

  test('should filter leads by trade type', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.multiTradeContractor);

    // Create leads with different trade types
    await createTestLead(contractor.id, {
      ...testLeads.roofingLead,
      tradeType: TradeType.ROOFING,
    });
    await createTestLead(contractor.id, {
      ...testLeads.kitchenLead,
      tradeType: TradeType.KITCHEN,
    });
    await createTestLead(contractor.id, {
      homeownerName: 'Bath Lead',
      homeownerEmail: 'bath@test.com',
      tradeType: TradeType.BATH,
    });

    await page.goto('/dashboard/leads');

    // Filter by KITCHEN trade type
    await page.selectOption('select[name="tradeType"]', TradeType.KITCHEN);

    // Should only see kitchen lead
    await expect(page.locator('text=/Bob Smith/i')).toBeVisible();
    await expect(page.locator('text=/Alice Johnson/i')).not.toBeVisible();
  });

  test('should sort leads by date', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);

    // Create leads with different dates
    const oldLead = await createTestLead(contractor.id, {
      homeownerName: 'Old Lead',
      homeownerEmail: 'old@test.com',
    });
    await prisma.lead.update({
      where: { id: oldLead.id },
      data: { createdAt: new Date('2024-01-01') },
    });

    const newLead = await createTestLead(contractor.id, {
      homeownerName: 'New Lead',
      homeownerEmail: 'new@test.com',
    });

    await page.goto('/dashboard/leads');

    // Sort by newest first (default)
    await page.selectOption('select[name="sort"]', 'newest');

    // First lead should be the newest
    const firstLead = page.locator('[data-testid="lead-card"], .lead-item, tr[data-lead]').first();
    await expect(firstLead).toContainText(/New Lead/i);

    // Sort by oldest first
    await page.selectOption('select[name="sort"]', 'oldest');

    // First lead should be the oldest
    const firstLeadAfterSort = page.locator('[data-testid="lead-card"], .lead-item').first();
    await expect(firstLeadAfterSort).toContainText(/Old Lead/i);
  });

  test('should sort leads by quality score', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);

    // Create leads with different scores
    await createTestLead(contractor.id, {
      homeownerName: 'High Score',
      homeownerEmail: 'high@test.com',
      score: 95,
    });
    await createTestLead(contractor.id, {
      homeownerName: 'Low Score',
      homeownerEmail: 'low@test.com',
      score: 45,
    });
    await createTestLead(contractor.id, {
      homeownerName: 'Medium Score',
      homeownerEmail: 'medium@test.com',
      score: 70,
    });

    await page.goto('/dashboard/leads');

    // Sort by highest score
    await page.selectOption('select[name="sort"]', 'score');

    // First lead should be highest score
    const firstLead = page.locator('[data-testid="lead-card"], .lead-item').first();
    await expect(firstLead).toContainText(/High Score/i);
  });

  test('should navigate to lead detail page', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    await createTestPhoto(lead.id);

    await page.goto('/dashboard/leads');

    // Click on the lead
    await page.click(`text=${testLeads.roofingLead.homeownerName}`);

    // Should navigate to lead detail page
    await expect(page).toHaveURL(new RegExp(`/leads/${lead.id}`));

    // Should see lead details
    await expect(page.locator('h1, h2')).toContainText(/Alice Johnson|Lead Details/i);
    await expect(page.locator(`text=${testLeads.roofingLead.homeownerEmail}`)).toBeVisible();
    await expect(page.locator(`text=${testLeads.roofingLead.address}`)).toBeVisible();

    // Should see photos
    await expect(page.locator('img[src*="test-photo"], [data-testid="photo"]')).toBeVisible();
  });

  test('should display lead thumbnails in list view', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    await createTestPhoto(lead.id, {
      url: 'https://test-bucket.s3.amazonaws.com/thumb.jpg',
    });

    await page.goto('/dashboard/leads');

    // Should see thumbnail image
    await expect(page.locator('img[src*="thumb.jpg"], img[src*="test-photo"]')).toBeVisible();
  });

  test('should show quality score badges', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);

    await createTestLead(contractor.id, {
      homeownerName: 'High Quality',
      homeownerEmail: 'high@test.com',
      score: 95,
    });
    await createTestLead(contractor.id, {
      homeownerName: 'Low Quality',
      homeownerEmail: 'low@test.com',
      score: 35,
    });

    await page.goto('/dashboard/leads');

    // Should see score indicators (exact implementation varies)
    await expect(page.locator('text=/95|high|excellent/i')).toBeVisible();
    await expect(page.locator('text=/35|low|poor/i')).toBeVisible();
  });

  test('should navigate to metrics page', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);

    await page.goto('/dashboard');

    // Click on metrics/analytics link
    await page.click('a[href*="/metrics"], text=/metrics|analytics/i');

    // Should navigate to metrics page
    await expect(page).toHaveURL(/\/dashboard\/metrics/);

    // Should see metrics content
    await expect(page.locator('text=/performance|accuracy|win rate/i')).toBeVisible();
  });

  test('should show empty state when no leads', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);

    await page.goto('/dashboard/leads');

    // Should see empty state message
    await expect(page.locator('text=/no leads|get started|create your first/i')).toBeVisible();
  });

  test('should combine filters (status + trade type)', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.multiTradeContractor);

    // Create various combinations
    await createTestLead(contractor.id, {
      homeownerName: 'New Roofing',
      homeownerEmail: 'newroof@test.com',
      status: 'NEW',
      tradeType: TradeType.ROOFING,
    });
    await createTestLead(contractor.id, {
      homeownerName: 'New Kitchen',
      homeownerEmail: 'newkitchen@test.com',
      status: 'NEW',
      tradeType: TradeType.KITCHEN,
    });
    await createTestLead(contractor.id, {
      homeownerName: 'Qualified Roofing',
      homeownerEmail: 'qualroof@test.com',
      status: 'QUALIFIED',
      tradeType: TradeType.ROOFING,
    });

    await page.goto('/dashboard/leads');

    // Filter: NEW + ROOFING
    await page.selectOption('select[name="status"]', 'NEW');
    await page.selectOption('select[name="tradeType"]', TradeType.ROOFING);

    // Should only see "New Roofing"
    await expect(page.locator('text=/New Roofing/i')).toBeVisible();
    await expect(page.locator('text=/New Kitchen/i')).not.toBeVisible();
    await expect(page.locator('text=/Qualified Roofing/i')).not.toBeVisible();
  });

  test('should show lead count after filtering', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);

    await createTestLead(contractor.id, { status: 'NEW' });
    await createTestLead(contractor.id, { status: 'NEW' });
    await createTestLead(contractor.id, { status: 'QUALIFIED' });

    await page.goto('/dashboard/leads');

    // Filter by NEW
    await page.selectOption('select[name="status"]', 'NEW');

    // Should show count of filtered results
    await expect(page.locator('text=/2 lead|showing 2/i')).toBeVisible();
  });
});
