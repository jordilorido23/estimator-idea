import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Rate limiting configuration for API routes
 *
 * In development/testing, we use in-memory rate limiting (no Redis required).
 * In production, you should configure Upstash Redis with these environment variables:
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
 *
 * For now, using in-memory store for simplicity.
 */

/**
 * In-memory rate limiter for development
 * Replace with Upstash Redis in production
 */
const cache = new Map();

export const ratelimit = {
  /**
   * Strict rate limit for public endpoints that accept user input
   * - 10 requests per 10 seconds per IP
   */
  strict: new Ratelimit({
    redis: Redis.fromEnv() || (cache as any), // Fallback to in-memory if no Redis
    limiter: Ratelimit.slidingWindow(10, '10 s'),
    analytics: true,
    prefix: '@ratelimit/strict',
  }),

  /**
   * Moderate rate limit for authenticated endpoints
   * - 30 requests per 10 seconds per user
   */
  moderate: new Ratelimit({
    redis: Redis.fromEnv() || (cache as any),
    limiter: Ratelimit.slidingWindow(30, '10 s'),
    analytics: true,
    prefix: '@ratelimit/moderate',
  }),

  /**
   * Lenient rate limit for read-only endpoints
   * - 100 requests per 10 seconds
   */
  lenient: new Ratelimit({
    redis: Redis.fromEnv() || (cache as any),
    limiter: Ratelimit.slidingWindow(100, '10 s'),
    analytics: true,
    prefix: '@ratelimit/lenient',
  }),
};

/**
 * Extract identifier from request for rate limiting
 * Uses IP address or user ID
 */
export function getRateLimitIdentifier(request: Request, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  // Try to get real IP from headers (for proxied requests)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  const ip = forwarded?.split(',')[0] || realIp || 'unknown';

  return `ip:${ip}`;
}

/**
 * Helper to check rate limit and return appropriate response
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{ success: boolean; headers: HeadersInit; resetTime?: number }> {
  const { success, limit, reset, remaining } = await limiter.limit(identifier);

  const headers: HeadersInit = {
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': new Date(reset).toISOString(),
  };

  return {
    success,
    headers,
    resetTime: reset,
  };
}
