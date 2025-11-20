#!/bin/bash

# Quick Start Script for ScopeGuard
# This script checks your environment and starts the development server

set -e

echo "🚀 ScopeGuard Quick Start"
echo "========================"
echo ""

# Check PostgreSQL
echo "Checking PostgreSQL..."
if lsof -i :5432 > /dev/null 2>&1; then
  echo "✅ PostgreSQL is running on port 5432"
else
  echo "⚠️  PostgreSQL is not running. Starting it..."
  brew services start postgresql@15
  sleep 2
fi

# Check database exists
echo ""
echo "Checking database..."
if psql -U jordilorido -d scopeguard -c "SELECT 1" > /dev/null 2>&1; then
  echo "✅ Database 'scopeguard' is accessible"
else
  echo "❌ Database 'scopeguard' not accessible"
  echo "Run: createdb scopeguard"
  exit 1
fi

# Check Prisma Client
echo ""
echo "Checking Prisma Client..."
if [ -d "node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0" ]; then
  echo "✅ Prisma Client is generated"
else
  echo "⚠️  Generating Prisma Client..."
  DATABASE_URL="postgresql://jordilorido@localhost:5432/scopeguard" npx prisma generate
fi

# Check for contractor
echo ""
echo "Checking seed data..."
CONTRACTOR_COUNT=$(psql -U jordilorido -d scopeguard -t -c "SELECT COUNT(*) FROM \"Contractor\";" 2>/dev/null | tr -d ' ')
if [ "$CONTRACTOR_COUNT" -gt 0 ]; then
  echo "✅ Found $CONTRACTOR_COUNT contractor(s) in database"
else
  echo "⚠️  No contractors found. Seeding database..."
  DATABASE_URL="postgresql://jordilorido@localhost:5432/scopeguard" pnpm exec tsx packages/db/prisma/seed.ts
fi

# Start development server
echo ""
echo "========================"
echo "✅ All checks passed!"
echo ""
echo "Starting development server..."
echo "Visit: http://localhost:3000"
echo "Intake: http://localhost:3000/intake/scopeguard-builders"
echo ""

pnpm dev
