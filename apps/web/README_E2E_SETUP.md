# ⚡ E2E Test Setup - IMPORTANT

## 🚨 Action Required: Grant Network Permission

Your e2e tests are currently **failing** because macOS Sequoia 15.1 blocks Playwright's browsers from accessing `localhost`.

### The Fix (Takes 2 minutes)

**Option 1: Run the automated script**

```bash
cd apps/web
./grant-e2e-permissions.sh
```

This will:
1. Open a Chromium browser window
2. Trigger macOS to show a permission dialog
3. Wait for you to click **"Allow"**

**Option 2: Manual setup**

```bash
# 1. Install browsers
cd apps/web
pnpm exec playwright install chromium

# 2. Trigger permission dialog
pnpm exec playwright test --project=chromium --headed e2e/01-lead-intake.spec.ts:15
```

When the macOS dialog appears saying:

> **"Chromium" would like to find and connect to devices on your local network**

👉 Click **"Allow"**

That's it! This is a **one-time setup**.

---

## ✅ After Granting Permission

Run your tests normally:

```bash
pnpm test:e2e              # Run all tests
pnpm test:e2e:ui           # Interactive UI
pnpm test:e2e:headed       # Watch tests run
```

---

## 📋 Verify Permission Was Granted

**Via System Settings:**
1. Open **System Settings** (⚙️)
2. **Privacy & Security** → **Local Network**
3. Find **"Chromium"** in the list
4. Make sure toggle is **ON** ✅

**Via Terminal:**
```bash
# Check if Chromium is installed
ls ~/Library/Caches/ms-playwright/chromium-*/chrome-mac/Chromium.app
```

---

## 🐛 Still Having Issues?

See detailed troubleshooting in [E2E_MACOS_SETUP.md](./E2E_MACOS_SETUP.md)

---

## 📚 Files Created

- **[E2E_QUICKSTART.md](./E2E_QUICKSTART.md)** - Quick reference for running tests
- **[E2E_MACOS_SETUP.md](./E2E_MACOS_SETUP.md)** - Detailed setup guide and troubleshooting
- **[grant-e2e-permissions.sh](./grant-e2e-permissions.sh)** - Automated setup script
- **[playwright.config.ts](./playwright.config.ts)** - Already configured for macOS Sequoia

---

## ❓ Why Is This Needed?

macOS Sequoia 15.1+ has a security feature called "Local Network Privacy" that prevents apps from accessing your local network (including `localhost`) without permission. Playwright's bundled browsers are sandboxed apps that need explicit permission.

This is a **one-time setup** per browser. Once granted, the permission persists across updates.

---

## 🎯 Next Steps

1. **Run the setup script:**
   ```bash
   cd apps/web
   ./grant-e2e-permissions.sh
   ```

2. **Click "Allow" when the dialog appears**

3. **Run your tests:**
   ```bash
   pnpm test:e2e
   ```

4. **Start finding and fixing product bugs!** 🐛🔧
