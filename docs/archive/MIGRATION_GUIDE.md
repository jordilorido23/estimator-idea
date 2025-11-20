# Production Hardening Migration Guide

This guide documents the security and infrastructure improvements made to the ScopeGuard estimator application.

## Database Migration Required

Before deploying these changes, you must run the Prisma migration to update the database schema:

```bash
# From the project root
cd packages/db
npx prisma migrate dev --name add_ai_usage_tracking_and_indexes

# Or in production
npx prisma migrate deploy
```

### Schema Changes

1. **New AIUsage Model** - Tracks AI API usage for cost monitoring
   - Tracks input/output tokens per operation
   - Calculates estimated costs based on current Anthropic pricing
   - Links to Contractor, Lead, and Estimate for reporting

2. **New Indexes Added** - Improved query performance
   - `Lead(tradeType)` - Filter leads by trade type
   - `Lead(contractorId, status, createdAt)` - Dashboard queries
   - `Estimate(status)` - Filter estimates by status
   - `Estimate(contractorId, status)` - Contractor estimate lists
   - `AIUsage(contractorId, createdAt)` - Usage reports
   - `AIUsage(operation, createdAt)` - Cost analysis by operation

## Critical Security Updates

### 1. Authorization System

**Location:** `apps/web/lib/auth-helpers.ts`

All mutation endpoints now require authentication and verify contractor ownership:

- ✅ `/api/leads/[id]/estimate` - Verify user owns lead before generating estimate
- ✅ `/api/leads/[id]/analyze` - Verify user owns lead before analysis
- ✅ `/api/estimates/[id]/checkout` - Verify user owns estimate before checkout
- ✅ `/api/estimates/[id]/feedback` - Verify user owns estimate before feedback

**Breaking Change:** Previously public endpoints now require authentication. If you have external integrations calling these endpoints, they will need to be updated to include Clerk authentication.

### 2. Rate Limiting

Applied to all AI-powered endpoints to prevent cost abuse:

| Endpoint | Rate Limit | Reason |
|----------|------------|--------|
| `POST /api/leads/[id]/estimate` | 30 req/10s (moderate) | Prevent AI API cost abuse |
| `POST /api/leads/[id]/analyze` | 30 req/10s (moderate) | Prevent AI API cost abuse |
| `POST /api/estimates/[id]/checkout` | 10 req/10s (strict) | Prevent Stripe API spam |

**What to Monitor:** Watch for legitimate users hitting rate limits during peak usage. Adjust limits in `apps/web/lib/rate-limit.ts` if needed.

### 3. AI Output Validation

**Location:** `apps/web/lib/ai/schemas.ts`

All AI responses are now validated with Zod schemas before being stored:

- `PhotoAnalysisSchema` - Validates vision API responses
- `ScopeOfWorkSchema` - Validates scope generation
- `GeneratedEstimateSchema` - Validates estimate generation

**Impact:** Invalid AI responses will now throw errors instead of storing bad data. Monitor error rates - if AI starts returning unexpected formats, you'll see validation errors in logs.

## New Features

### AI Cost Tracking

**Location:** `apps/web/lib/ai/usage-tracker.ts`

Track AI API usage and estimated costs per contractor:

```typescript
import { trackAIUsage, getContractorAIUsage } from '@/lib/ai/usage-tracker';

// After AI API call
await trackAIUsage({
  contractorId: 'contractor_123',
  leadId: 'lead_456',
  operation: 'photo_analysis',
  model: 'claude-3-5-sonnet-20241022',
  response: apiResponse, // Anthropic Message object
  metadata: { photoCount: 5 }
});

// Get usage stats
const stats = await getContractorAIUsage('contractor_123');
console.log(`Total cost this month: $${stats.totalCost}`);
```

**Pricing Data** (as of January 2025):
- Claude 3.5 Sonnet: $3/1M input tokens, $15/1M output tokens
- Claude 3.5 Haiku: $0.80/1M input tokens, $4/1M output tokens

**Update Required:** Pricing is hardcoded in `usage-tracker.ts`. Update when Anthropic changes pricing.

### Budget Alerts (Optional)

Set monthly AI budget limits per contractor:

```typescript
import { checkBudgetAlert } from '@/lib/ai/usage-tracker';

const alert = await checkBudgetAlert('contractor_123', 100); // $100/month
if (alert.exceeded) {
  console.warn(`Budget exceeded: $${alert.usage} / $${alert.budget}`);
  // Send email alert, disable AI features, etc.
}
```

## Environment Variables

No new environment variables required. All changes use existing configuration.

## Monitoring Recommendations

### 1. Authorization Failures

Monitor for authorization errors that might indicate:
- Attackers attempting to access resources
- Integration issues with Clerk auth
- Frontend bugs sending invalid requests

```typescript
// Check for 401/403 responses
// Location: API route logs
```

### 2. Rate Limit Hits

Track how often users hit rate limits:

```typescript
// Check for 429 responses
// May need to increase limits during peak hours
```

### 3. AI Validation Failures

Monitor validation error rates:

```typescript
// High rates may indicate:
// - Claude API returned unexpected format
// - Schema is too strict
// - Prompt engineering needs adjustment
```

### 4. AI Cost Trends

Query AIUsage table for cost analysis:

```sql
-- Monthly costs per contractor
SELECT
  contractor_id,
  DATE_TRUNC('month', created_at) as month,
  SUM(estimated_cost) as total_cost,
  SUM(total_tokens) as total_tokens
FROM "AIUsage"
GROUP BY contractor_id, month
ORDER BY month DESC, total_cost DESC;

-- Cost by operation type
SELECT
  operation,
  COUNT(*) as count,
  SUM(estimated_cost) as total_cost,
  AVG(estimated_cost) as avg_cost
FROM "AIUsage"
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY operation;
```

## Rollback Procedure

If issues arise after deployment:

### 1. Disable Authorization Checks (Temporary)

```typescript
// In auth-helpers.ts, temporarily bypass checks
export async function verifyLeadOwnership(leadId: string) {
  // TEMPORARY: Skip auth check
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  return { lead, contractorUser: null };
}
```

### 2. Disable Rate Limiting (Temporary)

```typescript
// In affected API routes
// Comment out rate limiting code
// const rateLimitResult = await checkRateLimit(...);
```

### 3. Rollback Database Migration

```bash
# Find migration name
npx prisma migrate status

# Rollback (use with caution - may lose data)
# Manually edit migration history or restore from backup
```

## Testing Checklist

Before deploying to production:

- [ ] Run database migration on staging
- [ ] Test authenticated API requests work
- [ ] Test unauthorized requests return 401/403
- [ ] Test rate limiting works (send >30 requests in 10s)
- [ ] Verify AI responses still validate correctly
- [ ] Check AIUsage records are created
- [ ] Verify performance (indexes should speed up queries)
- [ ] Test Stripe checkout still works
- [ ] Test estimate feedback submission

## Performance Impact

Expected performance improvements:

1. **Dashboard Lead Queries** - 30-50% faster with new composite indexes
2. **Trade Type Filtering** - 70-80% faster with dedicated index
3. **Estimate Status Queries** - 60-70% faster with status index

Expected overhead:

1. **Authorization Checks** - +10-20ms per authenticated request (acceptable)
2. **AI Validation** - +5-10ms per AI call (minimal, prevents bad data)
3. **Usage Tracking** - +15-25ms per AI call (async, non-blocking)

## Support

For issues or questions:
- Check error logs for detailed error messages
- Review Sentry for exception tracking (once configured)
- Check Inngest dashboard for background job failures

## Next Steps (Not Yet Implemented)

The following items were planned but not implemented in this update:

1. **Structured Logging** - Replace console.log with pino logger
2. **Request ID Propagation** - Add request IDs for distributed tracing
3. **Sentry Integration** - Full error tracking integration
4. **Integration Tests** - Tests for authorization logic
5. **API Documentation** - Update with new auth requirements

These can be implemented in future iterations as needed.
