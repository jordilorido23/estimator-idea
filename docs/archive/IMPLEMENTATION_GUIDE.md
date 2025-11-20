# Implementation Guide - Next Steps

This guide provides copy-paste ready code and step-by-step instructions for implementing the remaining improvements.

---

## 1. Adding Tests (Week 1 Priority)

### Install Testing Dependencies

```bash
pnpm add -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom happy-dom
```

### Create Test Setup

**File**: `apps/web/vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.ts', 'app/api/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

### Example Service Test

**File**: `apps/web/__tests__/lib/services/payment.service.test.ts`
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { paymentService } from '@/lib/services/payment.service';
import { prisma } from '@scopeguard/db';

// Mock Prisma
vi.mock('@scopeguard/db', () => ({
  prisma: {
    estimate: {
      findUnique: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
  },
}));

describe('PaymentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create checkout session with valid inputs', async () => {
    // Arrange
    const mockEstimate = {
      id: 'est_123',
      total: 10000,
      status: 'SENT',
      contractor: {
        id: 'cont_123',
        companyName: 'Test Contractor',
        depositPercentage: 25,
      },
      lead: {
        id: 'lead_123',
        homeownerEmail: 'test@example.com',
        homeownerName: 'Test User',
        address: '123 Main St',
        stripeCustomerId: 'cus_123',
      },
      payments: [],
    };

    vi.mocked(prisma.estimate.findUnique).mockResolvedValue(mockEstimate as any);
    vi.mocked(prisma.payment.create).mockResolvedValue({
      id: 'pay_123',
      amount: 2500,
      type: 'DEPOSIT',
      status: 'PENDING',
    } as any);

    // Act
    const result = await paymentService.createCheckoutSession({
      estimateId: 'est_123',
      paymentType: 'DEPOSIT',
    });

    // Assert
    expect(result.amount).toBe(2500); // 25% of 10000
    expect(result.sessionUrl).toBeDefined();
    expect(result.paymentId).toBe('pay_123');
  });

  it('should respect idempotency keys', async () => {
    // Arrange
    const idempotencyKey = 'unique-key-123';
    const existingPayment = {
      id: 'pay_existing',
      stripeCheckoutId: 'cs_existing',
      metadata: { sessionUrl: 'https://checkout.stripe.com/...' },
      amount: 2500,
    };

    vi.mocked(prisma.payment.findFirst).mockResolvedValue(existingPayment as any);

    // Act
    const result = await paymentService.createCheckoutSession({
      estimateId: 'est_123',
      paymentType: 'DEPOSIT',
      idempotencyKey,
    });

    // Assert
    expect(result.sessionId).toBe('cs_existing');
    expect(result.paymentId).toBe('pay_existing');
    expect(prisma.payment.create).not.toHaveBeenCalled(); // Should NOT create new payment
  });

  it('should throw BadRequestError for invalid estimate state', async () => {
    // Arrange
    const mockEstimate = {
      id: 'est_123',
      status: 'DRAFT', // Invalid for payment
      total: 10000,
      contractor: { depositPercentage: 25 },
      lead: {},
      payments: [],
    };

    vi.mocked(prisma.estimate.findUnique).mockResolvedValue(mockEstimate as any);

    // Act & Assert
    await expect(
      paymentService.createCheckoutSession({
        estimateId: 'est_123',
        paymentType: 'DEPOSIT',
      })
    ).rejects.toThrow('Estimate is not available for payment');
  });
});
```

### Run Tests

```bash
# Run all tests
pnpm test

# Run with UI
pnpm test:ui

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test -- --watch
```

---

## 2. Add API Versioning

### Create Versioned Route Structure

```bash
mkdir -p apps/web/app/api/v1/{estimates,leads,uploads}
```

### Example: Versioned Checkout Endpoint

**File**: `apps/web/app/api/v1/estimates/[id]/checkout/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { asyncHandler } from '@/lib/errors';
import { createRequestLogger } from '@/lib/logger';
import { paymentService } from '@/lib/services/payment.service';
import { verifyEstimateOwnership } from '@/lib/auth-helpers';
import { checkRateLimit, ratelimit } from '@/lib/rate-limit';

export const POST = asyncHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const log = createRequestLogger(request);
  log.info('V1: Checkout session creation started', { estimateId: params.id });

  // Authorization
  const { estimate, contractorUser } = await verifyEstimateOwnership(params.id);

  // Rate limiting
  const identifier = `checkout:${contractorUser.contractorId}`;
  const rateLimitResult = await checkRateLimit(ratelimit.strict, identifier);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded. Please try again later.',
        retryAfter: rateLimitResult.reset,
      },
      { status: 429, headers: rateLimitResult.headers }
    );
  }

  // Parse request body
  const body = await request.json();

  // Use service layer
  const result = await paymentService.createCheckoutSession({
    estimateId: params.id,
    paymentType: body.type || 'DEPOSIT',
    idempotencyKey: body.idempotencyKey,
  });

  return NextResponse.json(
    {
      version: 'v1',
      data: result,
    },
    { headers: rateLimitResult.headers }
  );
});
```

### Version Detection Middleware

**File**: `apps/web/lib/api-version.ts`
```typescript
import { NextRequest } from 'next/server';

export type APIVersion = 'v1' | 'v2';

/**
 * Detect API version from request
 * - From URL: /api/v1/...
 * - From header: X-API-Version: v1
 * - Default: v1
 */
export function getAPIVersion(request: NextRequest): APIVersion {
  // Check URL
  const urlMatch = request.nextUrl.pathname.match(/\/api\/(v\d+)\//);
  if (urlMatch) {
    return urlMatch[1] as APIVersion;
  }

  // Check header
  const headerVersion = request.headers.get('X-API-Version');
  if (headerVersion && ['v1', 'v2'].includes(headerVersion)) {
    return headerVersion as APIVersion;
  }

  // Default to v1
  return 'v1';
}
```

---

## 3. Add Input Sanitization

### Install Sanitization Library

```bash
pnpm add dompurify isomorphic-dompurify
pnpm add -D @types/dompurify
```

### Create Sanitization Utility

**File**: `apps/web/lib/sanitize.ts`
```typescript
import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize user input to prevent XSS attacks
 */
export function sanitizeText(input: string): string {
  // Remove all HTML tags, keep only text
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
}

/**
 * Sanitize HTML content (allow safe tags)
 */
export function sanitizeHTML(input: string): string {
  // Allow safe HTML tags for rich text
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href'],
  });
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Sanitize phone number (remove non-digits)
 */
export function sanitizePhone(input: string): string {
  return input.replace(/\D/g, '');
}
```

### Apply to Lead Intake

**File**: `apps/web/lib/validators/lead-intake.ts`
```typescript
import { z } from 'zod';
import { sanitizeText, sanitizeEmail, sanitizePhone } from '../sanitize';

export const leadIntakeSchema = z.object({
  homeownerName: z.string()
    .min(1)
    .max(100)
    .transform(sanitizeText),

  homeownerEmail: z.string()
    .email()
    .transform(sanitizeEmail),

  homeownerPhone: z.string()
    .min(10)
    .max(15)
    .transform(sanitizePhone),

  address: z.string()
    .min(5)
    .max(200)
    .transform(sanitizeText),

  description: z.string()
    .max(1000)
    .optional()
    .transform((val) => val ? sanitizeText(val) : undefined),

  // ... rest of schema
});
```

---

## 4. Add Monitoring with Sentry

### Install Sentry

```bash
pnpm add @sentry/nextjs
```

### Configure Sentry

**File**: `apps/web/instrumentation.ts`
```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const Sentry = await import('@sentry/nextjs');

    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1, // 10% of transactions

      // Performance monitoring
      profilesSampleRate: 0.1,

      // Error filtering
      beforeSend(event, hint) {
        // Don't send errors from development
        if (process.env.NODE_ENV === 'development') {
          return null;
        }

        // Don't send known user errors
        if (event.exception?.values?.[0]?.type === 'BadRequestError') {
          return null;
        }

        return event;
      },
    });
  }
}
```

### Add to Logger

**File**: `apps/web/lib/logger.ts` (add to error method)
```typescript
import * as Sentry from '@sentry/nextjs';

error(message: string, error?: Error, context?: LogContext) {
  this.write('error', message, context, error);

  // Send to Sentry in production
  if (process.env.NODE_ENV === 'production' && error) {
    Sentry.captureException(error, {
      extra: context,
      tags: {
        requestId: context?.requestId,
      },
    });
  }
}
```

---

## 5. Add Caching Layer (Redis)

### Install Redis Client

```bash
pnpm add ioredis
pnpm add -D @types/ioredis
```

### Create Cache Utility

**File**: `apps/web/lib/cache.ts`
```typescript
import Redis from 'ioredis';
import { logger } from './logger';

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redis.on('error', (error) => {
      logger.error('Redis connection error', error);
    });

    redis.on('connect', () => {
      logger.info('Redis connected');
    });
  }

  return redis;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

/**
 * Cache utility with Redis
 */
export class Cache {
  private redis: Redis;
  private prefix: string;

  constructor(prefix: string = 'scopeguard') {
    this.redis = getRedis();
    this.prefix = prefix;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(this.prefixKey(key));
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Cache get error', error as Error, { key });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(this.prefixKey(key), ttl, serialized);
    } catch (error) {
      logger.error('Cache set error', error as Error, { key });
    }
  }

  /**
   * Delete from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(this.prefixKey(key));
    } catch (error) {
      logger.error('Cache delete error', error as Error, { key });
    }
  }

  /**
   * Get or compute value
   */
  async getOrSet<T>(
    key: string,
    compute: () => Promise<T>,
    ttl: number = 3600
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Compute value
    const value = await compute();

    // Store in cache
    await this.set(key, value, ttl);

    return value;
  }

  private prefixKey(key: string): string {
    return `${this.prefix}:${key}`;
  }
}

// Singleton instances
export const cache = new Cache('scopeguard');
export const contractorCache = new Cache('contractor');
export const estimateCache = new Cache('estimate');
```

### Use Cache in API

**Example**: Cache contractor data
```typescript
import { contractorCache } from '@/lib/cache';

async function getContractor(slug: string) {
  return contractorCache.getOrSet(
    `contractor:${slug}`,
    async () => {
      return prisma.contractor.findUnique({
        where: { slug },
        include: { users: true },
      });
    },
    3600 // Cache for 1 hour
  );
}
```

---

## 6. Add Database Indexes

### Create Migration

```bash
cd packages/db
pnpm prisma migrate dev --name add_composite_indexes
```

### Add Indexes to Schema

**File**: `packages/db/prisma/schema.prisma`
```prisma
model Payment {
  // ... existing fields

  // New composite indexes
  @@index([estimateId, status, createdAt], name: "payment_estimate_status_date")
  @@index([stripeCheckoutId], name: "payment_stripe_checkout")
  @@index([metadata], name: "payment_metadata") // For idempotency key lookups
}

model Estimate {
  // ... existing fields

  // New composite indexes
  @@index([publicToken, status], name: "estimate_public_token_status")
  @@index([contractorId, status, createdAt], name: "estimate_contractor_dashboard")
}

model AIUsage {
  // ... existing fields

  // New composite indexes
  @@index([contractorId, operation, createdAt], name: "ai_usage_analysis")
  @@index([leadId, estimateId], name: "ai_usage_resources")
}

model Lead {
  // ... existing fields

  // Additional indexes for common queries
  @@index([stripeCustomerId], name: "lead_stripe_customer")
  @@index([homeownerEmail], name: "lead_email")
}
```

---

## 7. Add Feature Flags

### Install Feature Flag Library

```bash
pnpm add @openfeature/server-sdk @openfeature/flagd-provider
```

### Create Feature Flag Utility

**File**: `apps/web/lib/feature-flags.ts`
```typescript
import { OpenFeature, Client } from '@openfeature/server-sdk';

type FeatureFlags = {
  'new-estimate-ui': boolean;
  'ai-review-panel': boolean;
  'stripe-payment-links': boolean;
};

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    client = OpenFeature.getClient();
  }
  return client;
}

/**
 * Check if feature is enabled
 */
export async function isFeatureEnabled(
  flag: keyof FeatureFlags,
  context?: {
    userId?: string;
    contractorId?: string;
  }
): Promise<boolean> {
  if (process.env.NODE_ENV === 'development') {
    // All features enabled in development
    return true;
  }

  const client = getClient();
  const result = await client.getBooleanValue(flag, false, context);
  return result;
}

/**
 * Get feature flag value
 */
export async function getFeatureValue<T>(
  flag: string,
  defaultValue: T,
  context?: Record<string, any>
): Promise<T> {
  const client = getClient();

  if (typeof defaultValue === 'boolean') {
    return (await client.getBooleanValue(flag, defaultValue, context)) as T;
  }

  if (typeof defaultValue === 'string') {
    return (await client.getStringValue(flag, defaultValue, context)) as T;
  }

  if (typeof defaultValue === 'number') {
    return (await client.getNumberValue(flag, defaultValue, context)) as T;
  }

  return defaultValue;
}
```

### Use in API

```typescript
import { isFeatureEnabled } from '@/lib/feature-flags';

export const POST = asyncHandler(async (request) => {
  const useNewFlow = await isFeatureEnabled('new-estimate-ui', {
    userId: user.id,
    contractorId: contractor.id,
  });

  if (useNewFlow) {
    return generateEstimateV2(input);
  } else {
    return generateEstimateV1(input);
  }
});
```

---

## 8. Quick Wins (Do These Today)

### A. Add Request ID to All Responses

```typescript
// middleware.ts
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const response = NextResponse.next();

  // Add request ID to headers
  response.headers.set('X-Request-ID', requestId);

  return response;
}
```

### B. Add Stripe Webhook Validation

```typescript
// app/api/webhooks/stripe/route.ts
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    throw new BadRequestError('Missing Stripe signature');
  }

  // Validate timestamp to prevent replay attacks
  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );

    const eventAge = Date.now() / 1000 - event.created;
    if (eventAge > 300) {
      // Reject events older than 5 minutes
      throw new BadRequestError('Webhook event too old');
    }

    // Process event
    await handleWebhookEvent(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    throw new BadRequestError('Invalid Stripe signature');
  }
}
```

### C. Add Database Query Timeout

```typescript
// packages/db/src/index.ts
function createPrismaClient() {
  return new PrismaClient({
    datasources: {
      db: {
        url: `${process.env.DATABASE_URL}?statement_timeout=10000`, // 10 second timeout
      },
    },
  });
}
```

---

## Priority Timeline

### This Week
- ✅ Tests for PaymentService
- ✅ Add Stripe webhook validation
- ✅ Add request IDs to responses

### Next Week
- ✅ Extract LeadService
- ✅ Extract EstimateService
- ✅ Add API versioning

### Month 1
- ✅ Add Redis caching
- ✅ Add Sentry monitoring
- ✅ Add feature flags
- ✅ Improve database indexes

---

Need help with any of these? Each section is ready to copy-paste and customize for your needs!
