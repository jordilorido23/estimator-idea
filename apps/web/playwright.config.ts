import { defineConfig, devices } from '@playwright/test';
import dns from 'dns';

// Fix for macOS Sequoia 15.x: Force Node.js to prefer IPv4 over IPv6
// This resolves ERR_NAME_NOT_RESOLVED and NS_ERROR_UNKNOWN_HOST errors
// when accessing localhost in Playwright browsers
dns.setDefaultResultOrder('ipv4first');

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['list'],
    ...(process.env.CI ? [['github'] as const] : []),
  ],
  /* Global test timeout - increase for slow form interactions */
  timeout: 60000, // 60 seconds per test
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // Use localhost instead of 127.0.0.1 for macOS Sequoia compatibility
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    /* Video on failure */
    video: 'retain-on-failure',
    /* Increased timeout for form interactions (React Hook Form can be slow) */
    actionTimeout: 15000, // 15 seconds for individual actions
    navigationTimeout: 30000, // 30 seconds for page navigation
    /* Bypass browser security policies that may block localhost */
    bypassCSP: true,
    ignoreHTTPSErrors: true,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use system Chrome on macOS Sequoia for network permissions
        channel: 'chrome',
        // Disable web security and proxy to allow localhost connections
        launchOptions: {
          args: [
            '--disable-web-security',
            '--no-proxy-server',
            // Removed broken host-resolver-rules that was blocking 127.0.0.1 resolution
          ],
        },
      },
    },

    // Uncomment to test on other browsers
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            'network.proxy.type': 0, // No proxy
            'network.proxy.allow_hijacking_localhost': true,
            'network.dns.disableIPv6': false,
            'network.dns.ipv4OnlyDomains': '',
            'network.captive-portal-service.enabled': false,
          },
        },
      },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    // Force Next.js to listen on 0.0.0.0 (all interfaces including IPv4)
    // This is critical for macOS Sequoia 15.x compatibility (Next.js defaults to IPv6)
    // Using -H flag (standard Next.js flag) and -p to explicitly set port
    // E2E_BYPASS_AUTH=true disables Clerk auth in middleware for testing
    command: 'E2E_BYPASS_AUTH=true pnpm next dev -H 0.0.0.0 -p 3000',
    // Use localhost instead of 127.0.0.1 for macOS Sequoia compatibility
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe', // Changed from 'ignore' to see output
    stderr: 'pipe',
    timeout: 120 * 1000,
  },
});
