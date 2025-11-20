#!/bin/bash

echo "🔧 Setting up Playwright E2E Testing for macOS Sequoia..."
echo ""
echo "This script will:"
echo "  1. Install Playwright browsers (Chromium & Firefox)"
echo "  2. Open a test browser to trigger macOS permission dialog"
echo "  3. Wait for you to grant 'Local Network' permission"
echo ""
read -p "Press ENTER to continue..."
echo ""

# Step 1: Install browsers
echo "📦 Installing Playwright browsers..."
pnpm exec playwright install chromium firefox
echo "✅ Browsers installed to ~/Library/Caches/ms-playwright/"
echo ""

# Step 2: Trigger permission dialog for Chromium
echo "🔐 Opening Chromium browser to trigger macOS permission dialog..."
echo ""
echo "⚠️  ⚠️  ⚠️  IMPORTANT  ⚠️  ⚠️  ⚠️"
echo ""
echo "When macOS shows a dialog that says:"
echo "  'Chromium would like to find and connect to devices on your local network'"
echo ""
echo "👉 Click 'Allow' to grant permission"
echo ""
echo "The browser will open in 3 seconds..."
sleep 3

# Run a simple test in headed mode to trigger permission
pnpm exec playwright test --project=chromium --headed --timeout=90000 e2e/01-lead-intake.spec.ts:15 2>&1 || true

echo ""
echo "✅ Permission setup process complete!"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📋 NEXT STEPS:"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "1. Verify permission was granted:"
echo "   • Open System Settings → Privacy & Security → Local Network"
echo "   • Check that 'Chromium' is listed and toggled ON"
echo ""
echo "2. Run your E2E tests:"
echo "   • pnpm test:e2e                  (run all tests)"
echo "   • pnpm test:e2e:ui               (run with UI)"
echo "   • pnpm test:e2e:headed           (run with visible browser)"
echo ""
echo "3. If tests still fail, see E2E_MACOS_SETUP.md for troubleshooting"
echo ""
echo "═══════════════════════════════════════════════════════════"
