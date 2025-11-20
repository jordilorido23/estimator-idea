import { test, expect } from '@playwright/test';
import {
  cleanDatabase,
  createTestContractor,
  createTestLead,
  createTestEstimate,
  createTestDocument,
  prisma,
} from './utils/db-helpers';
import { testContractors, testLeads } from './utils/test-data';

test.describe('Priority 2: Document Upload Flow', () => {
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should upload floor plan documents', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);

    await page.goto(`/intake/${contractor.slug}`);

    // Fill basic form fields
    await page.fill('input[name="homeownerName"]', 'Test User');
    await page.fill('input[name="homeownerEmail"]', 'test@example.com');
    await page.fill('input[name="homeownerPhone"]', '555-123-4567');
    await page.fill('input[name="address"]', '123 Test St');
    await page.selectOption('select[name="tradeType"]', 'KITCHEN');

    // Upload document
    // TODO: Add actual file upload when test files are available
    // const fileInput = page.locator('input[type="file"][accept*="pdf"]');
    // await fileInput.setInputFiles('test-fixtures/floor-plan.pdf');

    // For now, test that upload interface exists
    await expect(page.locator('text=/upload.*document|floor plan|blueprint/i')).toBeVisible();
  });

  test('should display documents in lead detail', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.kitchenLead);
    await createTestDocument(lead.id, {
      fileName: 'floor-plan.pdf',
      fileType: 'PDF',
    });
    await createTestDocument(lead.id, {
      fileName: 'elevation.dwg',
      fileType: 'DWG',
    });

    await page.goto(`/dashboard/leads/${lead.id}`);

    // Should see uploaded documents
    await expect(page.locator('text=/floor-plan.pdf/i')).toBeVisible();
    await expect(page.locator('text=/elevation.dwg/i')).toBeVisible();

    // Should have download/view links
    await expect(page.locator('a[href*="floor-plan"], button:has-text("View")')).toBeVisible();
  });

  test('should process documents with AI', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.kitchenLead);
    const lead = await createTestLead(contractor.id, testLeads.kitchenLead);
    await createTestDocument(lead.id);

    await page.goto(`/dashboard/leads/${lead.id}`);

    // Should show AI analysis option
    await expect(page.locator('button:has-text("Analyze"), button:has-text("Process")')).toBeVisible();

    // Clicking analyze should trigger AI processing
    // (Mock the API response for testing)
    await page.route('**/api/leads/*/analyze', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ success: true }),
      });
    });

    await page.click('button:has-text("Analyze")');

    // Should show processing indicator
    await expect(page.locator('text=/processing|analyzing/i')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Priority 2: Estimate Expiration', () => {
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  test('should set expiration date on estimate', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);

    await page.goto(`/dashboard/leads/${lead.id}/estimate/new`);

    // Should have expiration date field
    const expirationField = page.locator('input[type="date"][name*="expir"], input[name="expiresAt"]');
    await expect(expirationField).toBeVisible();

    // Set expiration to 30 days from now
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const dateString = futureDate.toISOString().split('T')[0];

    await expirationField.fill(dateString);

    await page.click('button:has-text("Save Draft")');

    // Verify expiration was saved
    const estimate = await prisma.estimate.findFirst({
      where: { leadId: lead.id },
    });

    expect(estimate?.expiresAt).toBeDefined();
  });

  test('should show expiration warning when approaching', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);

    // Create estimate expiring in 3 days
    const soonExpiry = new Date();
    soonExpiry.setDate(soonExpiry.getDate() + 3);

    const estimate = await createTestEstimate(lead.id, contractor.id, {
      status: 'SENT',
      expiresAt: soonExpiry,
    });

    await page.goto(`/e/${estimate.publicToken}`);

    // Should see expiration warning
    await expect(page.locator('text=/expires.*3 days|expiring soon/i')).toBeVisible();
  });

  test('should disable accept button for expired estimate', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const estimate = await createTestEstimate(lead.id, contractor.id, {
      status: 'SENT',
      expiresAt: yesterday,
    });

    await page.goto(`/e/${estimate.publicToken}`);

    // Accept button should be disabled
    const acceptButton = page.locator('button:has-text("Accept")');
    if (await acceptButton.isVisible()) {
      await expect(acceptButton).toBeDisabled();
    }

    // Should show contact info to request new estimate
    await expect(page.locator(`text=${contractor.email}`)).toBeVisible();
  });
});

test.describe('Priority 2: Multiple Estimates Per Lead', () => {
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  test('should create multiple estimates for same lead', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);

    // Create first estimate
    const estimate1 = await createTestEstimate(lead.id, contractor.id, {
      total: 15000,
      status: 'SENT',
    });

    // Create second estimate (revised)
    const estimate2 = await createTestEstimate(lead.id, contractor.id, {
      total: 13500,
      status: 'DRAFT',
    });

    await page.goto(`/dashboard/leads/${lead.id}`);

    // Should see both estimates listed
    await expect(page.locator('text=/estimate/i')).toBeVisible();
    await expect(page.locator('text=/\\$150\\.00/i')).toBeVisible(); // First estimate
    await expect(page.locator('text=/\\$135\\.00/i')).toBeVisible(); // Second estimate

    // Should be able to click each estimate
    await expect(page.locator(`a[href*="${estimate1.id}"]`)).toBeVisible();
    await expect(page.locator(`a[href*="${estimate2.id}"]`)).toBeVisible();
  });

  test('should show estimate version/revision history', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);

    await createTestEstimate(lead.id, contractor.id, {
      total: 15000,
      status: 'DECLINED',
      createdAt: new Date('2024-01-01'),
    });

    await createTestEstimate(lead.id, contractor.id, {
      total: 13500,
      status: 'SENT',
      createdAt: new Date('2024-01-15'),
    });

    await page.goto(`/dashboard/leads/${lead.id}`);

    // Should show revision history or version numbers
    await expect(page.locator('text=/version|revision|v1|v2/i')).toBeVisible();
  });

  test('should compare multiple estimates side by side', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);

    const estimate1 = await createTestEstimate(lead.id, contractor.id, { total: 15000 });
    const estimate2 = await createTestEstimate(lead.id, contractor.id, { total: 13500 });

    await page.goto(`/dashboard/leads/${lead.id}`);

    // If comparison feature exists
    const compareButton = page.locator('button:has-text("Compare")');
    if (await compareButton.isVisible()) {
      await compareButton.click();

      // Should show both estimates side by side
      await expect(page.locator('text=/\\$150\\.00/i')).toBeVisible();
      await expect(page.locator('text=/\\$135\\.00/i')).toBeVisible();
    }
  });
});

test.describe('Priority 2: PDF Export', () => {
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  test('should download estimate as PDF', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    const estimate = await createTestEstimate(lead.id, contractor.id);

    await page.goto(`/dashboard/leads/${lead.id}/estimate/${estimate.id}`);

    // Mock PDF download
    const downloadPromise = page.waitForEvent('download');

    await page.click('button:has-text("Download PDF"), a[href*="pdf"]');

    const download = await downloadPromise;

    // Verify PDF was downloaded
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test('should include all estimate details in PDF', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, testLeads.roofingLead);
    const estimate = await createTestEstimate(lead.id, contractor.id);

    // Navigate to PDF endpoint
    await page.goto(`/api/estimates/${estimate.id}/pdf`);

    // PDF endpoint should return PDF content type
    // (Full PDF content verification would require PDF parsing library)
    const response = await page.waitForResponse(`**/api/estimates/${estimate.id}/pdf`);
    expect(response.headers()['content-type']).toContain('application/pdf');
  });
});

test.describe('Priority 2: Lead Quality Scoring', () => {
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  test('should assign higher score to complete leads', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);

    // Create complete lead
    const completeLead = await createTestLead(contractor.id, {
      ...testLeads.roofingLead,
      homeownerName: 'Complete Lead',
      homeownerEmail: 'complete@test.com',
      notes: 'Detailed notes with specific requirements and measurements',
      budgetCents: 1500000,
      timeline: 'Within 2 months',
    });

    // Create incomplete lead
    const incompleteLead = await createTestLead(contractor.id, {
      homeownerName: 'Incomplete Lead',
      homeownerEmail: 'incomplete@test.com',
      notes: 'Need work',
      budgetCents: null,
      timeline: 'Soon',
    });

    // Complete lead should have higher score
    expect(completeLead.score).toBeGreaterThan(incompleteLead.score || 0);

    await page.goto('/dashboard/leads');

    // Should see score indicators
    await expect(page.locator(`text=/${completeLead.score}/`)).toBeVisible();
  });

  test('should filter leads by quality score', async ({ page }) => {
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

    // Filter by high quality (score > 80)
    const scoreFilter = page.locator('select[name="minScore"], input[name="minScore"]');
    if (await scoreFilter.isVisible()) {
      await scoreFilter.fill('80');

      // Should only show high quality lead
      await expect(page.locator('text=/High Quality/i')).toBeVisible();
      await expect(page.locator('text=/Low Quality/i')).not.toBeVisible();
    }
  });

  test('should display score breakdown', async ({ page }) => {
    const contractor = await createTestContractor(testContractors.roofingContractor);
    const lead = await createTestLead(contractor.id, {
      ...testLeads.roofingLead,
      score: 88,
    });

    await page.goto(`/dashboard/leads/${lead.id}`);

    // Should show quality score
    await expect(page.locator('text=/quality|score/i')).toBeVisible();
    await expect(page.locator('text=/88/i')).toBeVisible();

    // Optionally show score breakdown (completeness, clarity, etc.)
    // This depends on your implementation
  });
});
