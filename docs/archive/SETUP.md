# ScopeGuard - Quick Setup Guide

## Prerequisites Setup

You have 3 options for the database:

### Option 1: Free Cloud Database (Recommended - Easiest)

1. **Sign up for a free PostgreSQL database** (choose one):
   - [Neon.tech](https://neon.tech) - Free tier, instant setup
   - [Supabase](https://supabase.com) - Free tier with additional features
   - [Railway](https://railway.app) - Free tier available

2. **Get your connection string** (looks like):
   ```
   postgresql://user:password@host.region.provider.tech:5432/database
   ```

3. **Update `.env` file** with your connection string:
   ```bash
   DATABASE_URL="your-connection-string-here"
   ```

### Option 2: Local PostgreSQL (If you prefer local)

```bash
# Install PostgreSQL via Homebrew
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb scopeguard

# Update .env
DATABASE_URL="postgresql://localhost:5432/scopeguard"
```

### Option 3: Docker (Quick local setup)

```bash
# Run PostgreSQL in Docker
docker run --name scopeguard-db \\
  -e POSTGRES_PASSWORD=password \\
  -e POSTGRES_DB=scopeguard \\
  -p 5432:5432 \\
  -d postgres:15

# Update .env
DATABASE_URL="postgresql://postgres:password@localhost:5432/scopeguard"
```

## Running the Application

Once you have a database set up:

```bash
# 1. Generate Prisma client and run migrations
cd packages/db
npx prisma generate
npx prisma migrate dev --name init

# 2. (Optional) Seed with sample data
npx prisma db seed

# 3. Go back to root and start the dev server
cd ../..
pnpm dev
```

The app will be available at: **http://localhost:3000**

## What Works Without Optional Services

✅ **Working with just DATABASE_URL + ANTHROPIC_API_KEY:**
- Lead intake forms
- AI photo analysis
- Scope of work generation
- Estimate creation
- Dashboard views

❌ **Requires additional setup:**
- User authentication (needs Clerk keys)
- Photo uploads (needs AWS S3)
- Email notifications (needs Resend key)

## Need Help?

The minimal setup to test the AI features:
1. Database (Option 1 above - takes 2 minutes)
2. Anthropic API key (already configured ✅)
3. Run migrations and start server

That's it! The AI-powered estimate generation will work.
