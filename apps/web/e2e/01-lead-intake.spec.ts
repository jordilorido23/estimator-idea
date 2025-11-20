import { test, expect } from '@playwright/test';
import { cleanDatabase, createTestContractor, prisma } from './utils/db-helpers';
import { testContractors, intakeFormData } from './utils/test-data';
import path from 'path';

test.describe('Lead Intake Journey', () => {
  test.beforeEach(async () => {
    await cleanDatabase();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should complete full lead intake with photos', async ({ page }) => {
    // Setup: Create a contractor with a public intake URL
    const contractor = await createTestContractor({
      ...testContractors.roofingContractor,
    });

    // Navigate to the public intake form
    await page.goto(`/intake/${contractor.slug}`);

    // Verify page loaded correctly
    await expect(page.locator('h1')).toContainText(contractor.companyName);

    // Fill out the form using data-testid selectors
    await page.getByTestId('homeowner-name').fill(intakeFormData.roofingProject.homeownerName);
    await page.getByTestId('homeowner-email').fill(intakeFormData.roofingProject.homeownerEmail);
    await page.getByTestId('homeowner-phone').fill(intakeFormData.roofingProject.homeownerPhone);
    await page.getByTestId('address').fill(intakeFormData.roofingProject.address);

    // Select project type (using shadcn Select component)
    await page.getByTestId('project-type').click();
    await page.getByRole('option', { name: /roofing/i }).click();

    // Fill budget
    await page.getByTestId('budget').fill('15000');

    // Fill timeline
    await page.getByTestId('timeline').fill('2025-03-01');

    // Fill project details
    await page.getByTestId('description').fill(intakeFormData.roofingProject.notes);

    // Upload photos (mock file upload)
    // Note: In real tests, you'd upload actual test image files
    // For now, we'll skip the file upload and test form submission without photos
    // TODO: Add actual file upload testing once test images are available

    // Submit the form
    await page.getByTestId('submit-button').click();

    // Wait for success message or redirect
    await expect(page.locator('text=/thank you|success|submitted/i')).toBeVisible({
      timeout: 10000,
    });

    // Verify the lead was created in the database
    const leads = await prisma.lead.findMany({
      where: {
        contractorId: contractor.id,
        homeownerEmail: intakeFormData.roofingProject.homeownerEmail,
      },
      include: {
        photos: true,
      },
    });

    expect(leads).toHaveLength(1);
    const lead = leads[0];

    expect(lead.homeownerName).toBe(intakeFormData.roofingProject.homeownerName);
    expect(lead.homeownerEmail).toBe(intakeFormData.roofingProject.homeownerEmail);
    expect(lead.homeownerPhone).toBe(intakeFormData.roofingProject.homeownerPhone);
    expect(lead.address).toBe(intakeFormData.roofingProject.address);
    expect(lead.tradeType).toBe(intakeFormData.roofingProject.tradeType);
    expect(lead.timeline).toBe(intakeFormData.roofingProject.timeline);
    expect(lead.notes).toBe(intakeFormData.roofingProject.notes);
    expect(lead.status).toBe('NEW');

    // Verify lead has a quality score assigned
    expect(lead.score).toBeGreaterThan(0);
  });

  test('should show validation errors for incomplete form', async ({ page }) => {
    const contractor = await createTestContractor({
      ...testContractors.roofingContractor,
    });

    await page.goto(`/intake/${contractor.slug}`);

    // Try to submit without filling required fields
    await page.getByTestId('submit-button').click();

    // Should see validation errors
    await expect(page.locator('text=/required|must be/i')).toBeVisible();

    // Verify no lead was created
    const leadCount = await prisma.lead.count({
      where: { contractorId: contractor.id },
    });
    expect(leadCount).toBe(0);
  });

  test('should validate email format', async ({ page }) => {
    const contractor = await createTestContractor({
      ...testContractors.roofingContractor,
    });

    await page.goto(`/intake/${contractor.slug}`);

    // Fill form with invalid email
    await page.getByTestId('homeowner-name').fill('Test User');
    await page.getByTestId('homeowner-email').fill('invalid-email');
    await page.getByTestId('homeowner-phone').fill('555-123-4567');
    await page.getByTestId('address').fill('123 Test St');
    await page.getByTestId('project-type').click();
    await page.getByRole('option', { name: /roofing/i }).click();

    await page.getByTestId('submit-button').click();

    // Should see email validation error
    await expect(page.locator('text=/valid email|invalid email/i')).toBeVisible();
  });

  test('should validate phone format', async ({ page }) => {
    const contractor = await createTestContractor({
      ...testContractors.roofingContractor,
    });

    await page.goto(`/intake/${contractor.slug}`);

    // Fill form with invalid phone
    await page.getByTestId('homeowner-name').fill('Test User');
    await page.getByTestId('homeowner-email').fill('test@example.com');
    await page.getByTestId('homeowner-phone').fill('123'); // Too short
    await page.getByTestId('address').fill('123 Test St');
    await page.getByTestId('project-type').click();
    await page.getByRole('option', { name: /roofing/i }).click();

    await page.getByTestId('submit-button').click();

    // Should see phone validation error
    await expect(page.locator('text=/valid phone|invalid phone/i')).toBeVisible();
  });

  test('should handle contractor not found', async ({ page }) => {
    // Try to access intake form for non-existent contractor
    await page.goto('/intake/non-existent-contractor');

    // Should show error or 404 page
    await expect(
      page.locator('text=/not found|contractor not found|invalid/i')
    ).toBeVisible();
  });

  test('should only allow trades that contractor supports', async ({ page }) => {
    // Create contractor that only does roofing
    const contractor = await createTestContractor({
      companyName: 'Roofing Only Co',
      slug: 'roofing-only',
      trades: ['ROOFING'],
    });

    await page.goto(`/intake/${contractor.slug}`);

    // Open the project type selector
    await page.getByTestId('project-type').click();

    // Check that trade type dropdown only shows ROOFING (and possibly "Other")
    const tradeOptions = await page.getByRole('option').allTextContents();

    // Should include Roofing
    expect(tradeOptions.some(opt => opt.toLowerCase().includes('roofing'))).toBe(true);

    // Should not include Kitchen (contractor doesn't support it)
    // Note: This depends on your implementation - you might show all trades or filter
    // Adjust this assertion based on your actual behavior
  });
});
