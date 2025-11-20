# E2E Testing Guide for ScopeGuard

This directory contains end-to-end (e2e) tests for the ScopeGuard application using Playwright.

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Writing Tests](#writing-tests)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

## Overview

The e2e test suite covers the following critical user journeys:

### Priority 1: Core Flows
1. **Lead Intake** ([01-lead-intake.spec.ts](./01-lead-intake.spec.ts))
   - Public form submission with validation
   - Photo uploads
   - Email notifications
   - Lead creation in database

2. **Estimate Creation** ([02-estimate-creation.spec.ts](./02-estimate-creation.spec.ts))
   - AI takeoff review
   - Line item management
   - Margin and contingency calculations
   - Draft/sent status management

3. **Public Estimate & Payment** ([03-public-estimate-payment.spec.ts](./03-public-estimate-payment.spec.ts))
   - Public estimate viewing (no auth)
   - Stripe checkout integration
   - Payment status tracking
   - Expiration handling

4. **Dashboard Navigation** ([04-dashboard-navigation.spec.ts](./04-dashboard-navigation.spec.ts))
   - Lead list filtering (status, trade type, score)
   - Sorting (date, quality score)
   - Lead detail views
   - Summary statistics

5. **Project Outcome Feedback** ([05-project-outcome-feedback.spec.ts](./05-project-outcome-feedback.spec.ts))
   - Recording WON/LOST/IN_PROGRESS/CANCELLED
   - Actual cost tracking
   - Variance calculation
   - AI feedback loop

### Priority 2: Important Features
6. **Additional Features** ([06-priority-2-features.spec.ts](./06-priority-2-features.spec.ts))
   - Document uploads (floor plans, blueprints)
   - Estimate expiration
   - Multiple estimates per lead
   - PDF export
   - Lead quality scoring

### Priority 3: Edge Cases & Validations
7. **Edge Cases** ([07-priority-3-edge-cases.spec.ts](./07-priority-3-edge-cases.spec.ts))
   - Form validation
   - Rate limiting
   - Authorization
   - Error handling
   - Stripe payment flows
   - Data integrity

## Setup

### Prerequisites

- Node.js 18+
- pnpm 9.1.0+
- PostgreSQL database (for test data)
- All environment variables configured in `.env`

### Installation

Playwright was installed automatically when you ran `pnpm install`. To install browser binaries:

```bash
pnpm exec playwright install chromium
```

### Database Setup

The e2e tests use the same database configured in your `.env` file. Before running tests:

1. Ensure your database is running
2. Run migrations to create the schema:
   ```bash
   pnpm db:migrate
   ```

**Important**: Tests will clean the database before each test suite runs. Do not run e2e tests against a production database!

For isolated testing, consider:
- Using a separate test database (set `DATABASE_URL` to a test DB)
- Using Docker Compose to spin up a test database:
  ```bash
  docker-compose -f docker-compose.test.yml up -d
  ```

## Running Tests

### Run all tests (headless)
```bash
pnpm test:e2e
```

### Run tests with UI mode (recommended for development)
```bash
pnpm test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
pnpm test:e2e:headed
```

### Run tests in debug mode
```bash
pnpm test:e2e:debug
```

### Run specific test file
```bash
pnpm exec playwright test 01-lead-intake.spec.ts
```

### Run specific test by name
```bash
pnpm exec playwright test -g "should complete full lead intake"
```

### View test report (after running tests)
```bash
pnpm test:e2e:report
```

### Run tests in parallel
```bash
pnpm exec playwright test --workers 4
```

Note: Current config runs tests sequentially (`workers: 1`) to avoid database conflicts. Adjust `playwright.config.ts` if you implement proper test isolation.

## Test Structure

```
e2e/
├── fixtures/
│   └── auth.ts                 # Authentication helpers and test fixtures
├── utils/
│   ├── db-helpers.ts           # Database setup/teardown and test data creation
│   └── test-data.ts            # Reusable test data factories
├── 01-lead-intake.spec.ts      # Lead intake form tests
├── 02-estimate-creation.spec.ts # Estimate creation and management
├── 03-public-estimate-payment.spec.ts # Public estimate viewing and payment
├── 04-dashboard-navigation.spec.ts # Dashboard filtering and navigation
├── 05-project-outcome-feedback.spec.ts # Outcome tracking and variance
├── 06-priority-2-features.spec.ts # Secondary features
├── 07-priority-3-edge-cases.spec.ts # Edge cases and error handling
└── README.md                   # This file
```

## Writing Tests

### Test Template

```typescript
import { test, expect } from '@playwright/test';
import { cleanDatabase, createTestContractor, prisma } from './utils/db-helpers';

test.describe('Feature Name', () => {
  test.beforeEach(async () => {
    await cleanDatabase(); // Clean DB before each test
  });

  test.afterAll(async () => {
    await prisma.$disconnect(); // Disconnect after suite
  });

  test('should do something', async ({ page }) => {
    // Setup: Create test data
    const contractor = await createTestContractor();

    // Action: Navigate and interact
    await page.goto(`/intake/${contractor.slug}`);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.click('button[type="submit"]');

    // Assert: Verify results
    await expect(page.locator('text=/success/i')).toBeVisible();

    // Verify database
    const lead = await prisma.lead.findFirst({
      where: { homeownerEmail: 'test@example.com' },
    });
    expect(lead).toBeDefined();
  });
});
```

### Best Practices

1. **Database Isolation**
   - Always call `cleanDatabase()` in `beforeEach`
   - Never rely on data from previous tests
   - Use test data factories from `utils/test-data.ts`

2. **Selectors**
   - Prefer `data-testid` attributes: `page.locator('[data-testid="submit-btn"]')`
   - Use semantic selectors: `button:has-text("Submit")`
   - Avoid CSS classes (they change frequently)

3. **Assertions**
   - Use `toBeVisible()` instead of checking element existence
   - Add timeout for async operations: `{ timeout: 5000 }`
   - Verify both UI state and database state

4. **Mocking External APIs**
   ```typescript
   await page.route('**/api/claude/**', async (route) => {
     await route.fulfill({
       status: 200,
       body: JSON.stringify({ result: 'mocked' }),
     });
   });
   ```

5. **Authentication**
   - Use auth helpers from `fixtures/auth.ts`
   - Mock Clerk authentication for contractor dashboard tests
   - Public pages (intake, estimate view) don't need auth

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm exec playwright install chromium --with-deps

      - name: Run database migrations
        run: pnpm db:migrate
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

      - name: Run e2e tests
        run: pnpm test:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          # Add other required env vars

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## Environment Variables

Required for e2e tests:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/scopeguard-test

# Clerk (can use test keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Stripe (use test mode keys)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# AWS S3 (can use LocalStack for tests)
AWS_S3_BUCKET=test-bucket
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test

# Optional: Mock external services
ANTHROPIC_API_KEY=test-key (mock in tests)
RESEND_API_KEY=test-key (mock in tests)
```

## Troubleshooting

### Tests are failing with "Element not found"

- Increase timeout: `await expect(locator).toBeVisible({ timeout: 10000 })`
- Check if the page loaded: `await page.waitForLoadState('networkidle')`
- Verify selector with Playwright Inspector: `pnpm test:e2e:debug`

### Database errors

- Ensure PostgreSQL is running: `pg_isready`
- Check DATABASE_URL is correct
- Run migrations: `pnpm db:migrate`
- Check database permissions

### Authentication issues

- Implement Clerk test authentication in `fixtures/auth.ts`
- Use Clerk test mode or mock authentication
- Ensure `CLERK_SECRET_KEY` is set

### Tests are slow

- Run in parallel (if database isolation is implemented)
- Use headless mode for CI
- Mock heavy external API calls (Claude, Stripe, S3)

### Port 3000 already in use

- Change port in `playwright.config.ts`: `url: 'http://localhost:3001'`
- Or kill existing process: `lsof -ti:3000 | xargs kill`

## TODO Items

The following items need to be completed for full e2e coverage:

1. **Authentication Implementation**
   - [ ] Set up Clerk test authentication in `fixtures/auth.ts`
   - [ ] Create authenticated page fixtures
   - [ ] Test role-based access control (OWNER, ESTIMATOR, PM)

2. **File Upload Testing**
   - [ ] Add test image files to `e2e/fixtures/`
   - [ ] Test photo uploads in intake form
   - [ ] Test document uploads (PDF, DWG)
   - [ ] Verify file size limits and validation

3. **External API Mocking**
   - [ ] Mock Claude API responses for AI analysis
   - [ ] Mock Stripe checkout and webhooks
   - [ ] Mock Resend email sending
   - [ ] Mock S3 uploads (or use LocalStack)

4. **Test Data Isolation**
   - [ ] Consider using transaction rollbacks for faster cleanup
   - [ ] Implement parallel test execution with isolated databases
   - [ ] Add database seeding scripts for consistent test states

5. **Visual Regression Testing**
   - [ ] Add Playwright screenshot comparison tests
   - [ ] Test responsive layouts (mobile, tablet, desktop)
   - [ ] Verify PDF rendering

6. **Accessibility Testing**
   - [ ] Add Playwright accessibility tests (`@axe-core/playwright`)
   - [ ] Test keyboard navigation
   - [ ] Verify ARIA labels and roles

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
- [Next.js Testing Guide](https://nextjs.org/docs/testing)
