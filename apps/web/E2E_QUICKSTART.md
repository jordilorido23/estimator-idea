# E2E Testing Quick Start

## 🚨 FIRST TIME SETUP (macOS Sequoia 15.1+ only)

If you're on macOS Sequoia 15.1 or later, you need to grant network permissions **ONE TIME**:

```bash
cd apps/web
./grant-e2e-permissions.sh
```

When the browser opens, **click "Allow"** on the macOS dialog.

**OR** manually via System Settings:
1. System Settings → Privacy & Security → Local Network
2. Find "Chromium" and toggle it **ON**

---

## ✅ Running Tests

Once permissions are granted:

```bash
# Run all tests (headless)
pnpm test:e2e

# Run with UI (interactive test runner)
pnpm test:e2e:ui

# Run with visible browser (headed mode)
pnpm test:e2e:headed

# Run specific test file
pnpm exec playwright test e2e/01-lead-intake.spec.ts

# Run in debug mode
pnpm test:e2e:debug
```

---

## 📊 View Test Results

```bash
# Open HTML report
pnpm test:e2e:report
```

---

## 🐛 Common Issues

### Tests fail with `ERR_NAME_NOT_RESOLVED`
→ You need to grant Local Network permission (see First Time Setup above)

### Tests fail with `Executable doesn't exist`
→ Install browsers: `pnpm exec playwright install`

### Server won't start
→ Kill existing processes: `pkill -f "next dev"`

---

## 📖 More Help

See [E2E_MACOS_SETUP.md](./E2E_MACOS_SETUP.md) for detailed troubleshooting.
