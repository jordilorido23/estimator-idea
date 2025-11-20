# Phase 1A: Database Schema Migration

## Changes Made

### New Enum: ProjectOutcome
```prisma
enum ProjectOutcome {
  WON           // Project was awarded and completed
  LOST          // Estimate was not accepted
  IN_PROGRESS   // Project is currently underway
  CANCELLED     // Project was cancelled
}
```

### Estimate Model Updates
Added 6 new fields for tracking project outcomes and estimate accuracy:

| Field | Type | Description |
|-------|------|-------------|
| `projectOutcome` | `ProjectOutcome?` | Current project status (nullable) |
| `actualCost` | `Decimal?` | Final project cost (nullable) |
| `completedAt` | `DateTime?` | When project was marked won/lost (nullable) |
| `feedbackNotes` | `String?` | Contractor notes about the project (Text, nullable) |
| `variance` | `Decimal?` | Calculated: actualCost - total (nullable) |
| `variancePercent` | `Decimal(8,2)?` | Calculated: (variance / total) * 100 (nullable) |

**Important Fix:** `variancePercent` uses `Decimal(8,2)` (not 5,2) to support large variances up to ±999,999.99%

**New Index:** `@@index([projectOutcome, completedAt])` for dashboard queries

### Takeoff Model Updates
Added 4 new fields for AI analysis accuracy tracking:

| Field | Type | Description |
|-------|------|-------------|
| `reviewedAt` | `DateTime?` | When contractor reviewed the analysis (nullable) |
| `accuracyFeedback` | `Json?` | Array of field-level feedback (nullable) |
| `overallAccuracy` | `Float?` | 0-1 score based on feedback (nullable) |
| `reviewNotes` | `String?` | Contractor notes about AI accuracy (Text, nullable) |

**`accuracyFeedback` JSON Structure:**
```typescript
[
  { field: "photo_0_trades", correct: true },
  { field: "photo_0_materials", correct: false, correctedValue: "Vinyl siding" },
  { field: "scope_summary", correct: true }
]
```

**New Index:** `@@index([reviewedAt])` for analytics queries

---

## Running the Migration

### Prerequisites
You need ONE of the following:
- Docker installed (easiest - local database)
- PostgreSQL installed locally
- A remote PostgreSQL database URL

### Option 1: Using Docker (Recommended)

1. **Start PostgreSQL container:**
   ```bash
   docker compose up -d
   ```

2. **Navigate to database package:**
   ```bash
   cd packages/db
   ```

3. **Run migration:**
   ```bash
   pnpm migrate:dev
   ```

   When prompted for a migration name:
   ```
   ✔ Enter a name for the new migration: … add_estimate_feedback_and_ai_review
   ```

4. **Generate Prisma client:**
   ```bash
   pnpm generate
   ```

5. **Verify migration (optional):**
   ```bash
   pnpm prisma studio
   ```
   This opens a GUI at http://localhost:5555 to inspect the schema

### Option 2: Using a Remote Database

1. **Update `.env` with your database URL:**
   ```bash
   DATABASE_URL="postgresql://username:password@host:port/database"
   ```

2. **Run migration:**
   ```bash
   cd packages/db
   pnpm migrate:dev
   pnpm generate
   ```

### Option 3: Install PostgreSQL Locally

1. **Install PostgreSQL:**
   ```bash
   # macOS with Homebrew
   brew install postgresql@15
   brew services start postgresql@15

   # Create database
   createdb scopeguard
   ```

2. **Update `.env`:**
   ```bash
   DATABASE_URL="postgresql://localhost:5432/scopeguard"
   ```

3. **Run migration:**
   ```bash
   cd packages/db
   pnpm migrate:dev
   pnpm generate
   ```

---

## Validation Checklist

After running the migration, verify everything works:

### 1. Check Migration Status
```bash
cd packages/db
pnpm prisma migrate status
```

Expected output:
```
Database schema is up to date!
```

### 2. Inspect Database Schema
```bash
pnpm prisma studio
```

In Prisma Studio (http://localhost:5555), verify:
- [ ] `ProjectOutcome` enum exists with 4 values
- [ ] `Estimate` table has 6 new fields:
  - [ ] `projectOutcome` (ProjectOutcome, nullable)
  - [ ] `actualCost` (Decimal, nullable)
  - [ ] `completedAt` (DateTime, nullable)
  - [ ] `feedbackNotes` (Text, nullable)
  - [ ] `variance` (Decimal, nullable)
  - [ ] `variancePercent` (Decimal, nullable)
- [ ] `Takeoff` table has 4 new fields:
  - [ ] `reviewedAt` (DateTime, nullable)
  - [ ] `accuracyFeedback` (Json, nullable)
  - [ ] `overallAccuracy` (Float, nullable)
  - [ ] `reviewNotes` (Text, nullable)

### 3. Check TypeScript Types
```bash
cd ../..
pnpm typecheck
```

Expected: No TypeScript errors

### 4. Verify Prisma Client Types

Create a test file `packages/db/test-types.ts`:
```typescript
import { prisma } from './src/index';

// This should compile without errors
async function testTypes() {
  // Test Estimate with new fields
  const estimate = await prisma.estimate.findFirst({
    select: {
      id: true,
      projectOutcome: true,
      actualCost: true,
      variance: true,
      variancePercent: true,
    }
  });

  // Test Takeoff with new fields
  const takeoff = await prisma.takeoff.findFirst({
    select: {
      id: true,
      reviewedAt: true,
      accuracyFeedback: true,
      overallAccuracy: true,
    }
  });

  console.log('Types are correct!');
}
```

Run TypeScript check:
```bash
cd packages/db
npx tsc --noEmit test-types.ts
```

If successful, delete the test file:
```bash
rm test-types.ts
```

### 5. Test Database Write

Create a test script `packages/db/test-migration.ts`:
```typescript
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function testMigration() {
  try {
    console.log('Testing new Estimate fields...');

    // Find an existing estimate (or create a test one)
    const estimate = await prisma.estimate.findFirst();

    if (estimate) {
      // Test updating with new fields
      const updated = await prisma.estimate.update({
        where: { id: estimate.id },
        data: {
          projectOutcome: 'WON',
          actualCost: new Prisma.Decimal(5000.50),
          completedAt: new Date(),
          feedbackNotes: 'Test feedback',
          variance: new Prisma.Decimal(200.50),
          variancePercent: new Prisma.Decimal(4.18), // 200.50 / 4800 * 100
        }
      });

      console.log('✓ Successfully updated Estimate with feedback fields');
      console.log('  Project Outcome:', updated.projectOutcome);
      console.log('  Actual Cost:', updated.actualCost?.toString());
      console.log('  Variance:', updated.variance?.toString());
      console.log('  Variance %:', updated.variancePercent?.toString() + '%');

      // Clean up test data
      await prisma.estimate.update({
        where: { id: estimate.id },
        data: {
          projectOutcome: null,
          actualCost: null,
          completedAt: null,
          feedbackNotes: null,
          variance: null,
          variancePercent: null,
        }
      });
      console.log('✓ Cleaned up test data');
    } else {
      console.log('⚠ No estimates found to test with');
    }

    console.log('\nTesting new Takeoff fields...');

    const takeoff = await prisma.takeoff.findFirst();

    if (takeoff) {
      const updated = await prisma.takeoff.update({
        where: { id: takeoff.id },
        data: {
          reviewedAt: new Date(),
          accuracyFeedback: [
            { field: 'test_field', correct: true }
          ],
          overallAccuracy: 0.95,
          reviewNotes: 'Test review',
        }
      });

      console.log('✓ Successfully updated Takeoff with review fields');
      console.log('  Overall Accuracy:', updated.overallAccuracy);
      console.log('  Feedback Count:', (updated.accuracyFeedback as any[])?.length || 0);

      // Clean up
      await prisma.takeoff.update({
        where: { id: takeoff.id },
        data: {
          reviewedAt: null,
          accuracyFeedback: null,
          overallAccuracy: null,
          reviewNotes: null,
        }
      });
      console.log('✓ Cleaned up test data');
    } else {
      console.log('⚠ No takeoffs found to test with');
    }

    console.log('\n✅ All migration tests passed!');
  } catch (error) {
    console.error('❌ Migration test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testMigration();
```

Run the test:
```bash
cd packages/db
npx tsx test-migration.ts
```

Expected output:
```
Testing new Estimate fields...
✓ Successfully updated Estimate with feedback fields
  Project Outcome: WON
  Actual Cost: 5000.50
  Variance: 200.50
  Variance %: 4.18%
✓ Cleaned up test data

Testing new Takeoff fields...
✓ Successfully updated Takeoff with review fields
  Overall Accuracy: 0.95
  Feedback Count: 1
✓ Cleaned up test data

✅ All migration tests passed!
```

Delete the test file when done:
```bash
rm test-migration.ts
```

---

## Troubleshooting

### Error: "Environment variable not found: DATABASE_URL"

**Solution:** Create a `.env` file in the project root with:
```bash
DATABASE_URL="postgresql://username:password@host:port/database"
```

### Error: "Can't reach database server"

**Solution:**
1. Check database is running: `docker ps` or `brew services list postgresql@15`
2. Verify connection string in `.env`
3. Test connection: `cd packages/db && pnpm prisma db pull`

### Error: "Migration already applied"

**Solution:** The migration ran successfully before. Check status:
```bash
pnpm prisma migrate status
```

### Error: "Type ... is not assignable to type ..."

**Solution:** Regenerate Prisma client:
```bash
cd packages/db
pnpm generate
```

Then restart TypeScript server in VSCode:
- Cmd+Shift+P → "TypeScript: Restart TS Server"

### Error: "Column 'variancePercent' value out of range"

**Solution:** This shouldn't happen with Decimal(8,2), but if it does:
1. Check the variance calculation logic
2. Verify no existing data has invalid values
3. The maximum supported variance is ±999,999.99%

---

## Rollback (Emergency Only)

⚠️ **WARNING: This will delete all feedback data**

If you need to undo the migration:

```bash
cd packages/db

# Mark migration as rolled back
pnpm prisma migrate resolve --rolled-back add_estimate_feedback_and_ai_review

# Or reset entire database (DESTROYS ALL DATA)
pnpm prisma migrate reset
```

---

## Next Steps

Once validation is complete:

1. ✅ **Phase 1A Complete** - Database schema is ready
2. → **Phase 1B** - Build estimate feedback form
3. → **Phase 1C** - Build accuracy metrics dashboard
4. → **Phase 1D** - Build AI analysis review interface

---

## Summary

**What changed:**
- Added `ProjectOutcome` enum
- Added 6 fields to `Estimate` for feedback tracking
- Added 4 fields to `Takeoff` for AI review
- Created 2 new indexes for query performance
- **Fixed:** Variance percentage supports large values (up to ±999,999.99%)

**Migration safety:**
- All new fields are **nullable** (optional)
- No existing data is modified
- No breaking changes to existing code
- Can be rolled back if needed

**Validation required:**
- Migration applied successfully
- Prisma client regenerated
- TypeScript has no errors
- Database writes work correctly

**Time estimate:** 15-30 minutes including validation
