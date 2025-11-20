# E2E Testing Setup for macOS Sequoia 15.1+

## The Problem

macOS Sequoia 15.1 introduced "Local Network Privacy" restrictions that prevent bundled applications (like Playwright's browsers) from accessing `localhost` without explicit permission.

**Symptoms:**
- E2E tests fail with `ERR_NAME_NOT_RESOLVED` or `NS_ERROR_UNKNOWN_HOST`
- Error: "page.goto: net::ERR_NAME_NOT_RESOLVED at http://localhost:3000"
- Tests work when run manually in your system browser, but fail in Playwright

## The Solution

You need to grant "Local Network" permission to Playwright's browsers. This is a **ONE-TIME setup** that macOS requires.

---

## Step 1: Install Playwright Browsers (if not already installed)

```bash
cd apps/web
pnpm exec playwright install chromium firefox
```

This downloads Playwright's bundled browsers to:
- `~/Library/Caches/ms-playwright/chromium-*/`
- `~/Library/Caches/ms-playwright/firefox-*/`

---

## Step 2: Trigger the Permission Dialog

Run a single test in **headed mode** (visible browser window). This will trigger macOS to ask for permission:

```bash
cd apps/web
pnpm exec playwright test --project=chromium --headed --timeout=60000 e2e/01-lead-intake.spec.ts:15
```

### What to Expect:

1. A Chrome browser window will open
2. **macOS will show a system dialog** that says:

   > "Chromium" would like to find and connect to devices on your local network.

   **Click "Allow"** ✅

3. The test may still fail (that's okay for now), but permission is granted
4. Close the browser window

---

## Step 3: Grant Permission for Firefox (Optional)

If you want to run tests on Firefox as well:

```bash
cd apps/web
pnpm exec playwright test --project=firefox --headed --timeout=60000 e2e/01-lead-intake.spec.ts:15
```

Click **"Allow"** when the Firefox permission dialog appears.

---

## Step 4: Verify Permissions Were Granted

### Option A: Via System Settings (GUI)

1. Open **System Settings** (⚙️)
2. Go to **Privacy & Security**
3. Scroll down and click **Local Network**
4. You should see **"Chromium"** and/or **"Firefox"** in the list
5. Make sure the toggle is **ON** (blue/green)

### Option B: Via Terminal (Quick Check)

```bash
# Check if Chromium has network access
ls ~/Library/Caches/ms-playwright/chromium-*/chrome-mac/Chromium.app/Contents/MacOS/Chromium

# If this file exists, the browser is installed correctly
```

---

## Step 5: Run Tests Normally (Headless Mode)

Once permission is granted, you can run tests normally:

```bash
cd apps/web

# Run all tests
pnpm test:e2e

# Run specific test file
pnpm exec playwright test e2e/01-lead-intake.spec.ts

# Run with UI
pnpm test:e2e:ui
```

---

## Troubleshooting

### Tests Still Failing After Granting Permission

**Try this command to re-grant permission:**

```bash
# Force macOS to re-prompt for permission
cd apps/web
xattr -cr ~/Library/Caches/ms-playwright/chromium-*/chrome-mac/Chromium.app
pnpm exec playwright test --project=chromium --headed e2e/01-lead-intake.spec.ts:15
```

### Permission Dialog Never Appears

If the dialog doesn't show up:

1. **Manually add permission via System Settings:**
   - System Settings → Privacy & Security → Local Network
   - Click the **(+)** button
   - Navigate to: `~/Library/Caches/ms-playwright/chromium-*/chrome-mac/Chromium.app`
   - Add it and toggle **ON**

2. **Or use Firewall settings:**
   ```bash
   # Allow incoming connections to Chromium
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add ~/Library/Caches/ms-playwright/chromium-*/chrome-mac/Chromium.app/Contents/MacOS/Chromium
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp ~/Library/Caches/ms-playwright/chromium-*/chrome-mac/Chromium.app/Contents/MacOS/Chromium
   ```

### Alternative: Use System Chrome Instead

If you don't want to deal with Playwright's bundled browsers, you can use your system-installed Chrome:

**In `playwright.config.ts`:**
```typescript
projects: [
  {
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      channel: 'chrome', // Use system Chrome instead of bundled Chromium
    },
  },
]
```

**Note:** Your system Chrome should already have Local Network permission since you've used it before.

---

## Why Does This Happen?

- **macOS Sequoia 15.1+** requires apps to request permission before accessing local network
- Playwright's **bundled browsers** are sandboxed and need explicit permission
- **Terminal.app** has permission, but that doesn't extend to browsers it launches
- This is a macOS security feature, not a bug

---

## Quick Start Script

Save this as `grant-e2e-permissions.sh`:

```bash
#!/bin/bash

echo "🔧 Setting up Playwright browsers for macOS Sequoia..."
echo ""

# Step 1: Install browsers
echo "📦 Installing Playwright browsers..."
cd apps/web
pnpm exec playwright install chromium firefox
echo "✅ Browsers installed"
echo ""

# Step 2: Trigger permission dialog for Chromium
echo "🔐 Opening Chromium to trigger permission dialog..."
echo "⚠️  IMPORTANT: Click 'Allow' when macOS asks for permission!"
echo ""
pnpm exec playwright test --project=chromium --headed --timeout=60000 e2e/01-lead-intake.spec.ts:15 || true

echo ""
echo "✅ Setup complete!"
echo ""
echo "To verify permissions:"
echo "  System Settings → Privacy & Security → Local Network → Chromium (should be ON)"
echo ""
echo "To run tests:"
echo "  pnpm test:e2e"
```

Make it executable and run:
```bash
chmod +x grant-e2e-permissions.sh
./grant-e2e-permissions.sh
```

---

## Need Help?

- [Playwright macOS Localhost Issues](https://github.com/microsoft/playwright/issues/29037)
- [Apple Support: Local Network Privacy](https://support.apple.com/guide/mac-help/control-access-local-network-mchl0514b973/mac)
