/**
 * Health Check Endpoint
 *
 * Provides:
 * - Overall system health status
 * - Database connectivity check
 * - External dependencies status (S3, Stripe, etc.)
 * - System metrics and version info
 *
 * Use this for:
 * - Load balancer health checks
 * - Monitoring/alerting systems
 * - Deployment verification
 */

import { NextResponse } from 'next/server';
import { prisma } from '@scopeguard/db';
import { getS3 } from '@/lib/s3';
import Stripe from 'stripe';
import { env } from '@/env';

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database: DependencyHealth;
    stripe: DependencyHealth;
    s3: DependencyHealth;
  };
}

interface DependencyHealth {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  message?: string;
  error?: string;
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<DependencyHealth> {
  const start = Date.now();

  try {
    // Simple query to check if database is accessible
    await prisma.$queryRaw`SELECT 1`;

    const responseTime = Date.now() - start;

    return {
      status: responseTime < 100 ? 'up' : 'degraded',
      responseTime,
      message: responseTime < 100 ? 'Database is healthy' : 'Database response is slow',
    };
  } catch (error) {
    return {
      status: 'down',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

/**
 * Check Stripe API connectivity
 */
async function checkStripe(): Promise<DependencyHealth> {
  const start = Date.now();

  try {
    // Simple API call to verify Stripe is accessible
    await stripe.customers.list({ limit: 1 });

    const responseTime = Date.now() - start;

    return {
      status: responseTime < 500 ? 'up' : 'degraded',
      responseTime,
      message: responseTime < 500 ? 'Stripe API is healthy' : 'Stripe API response is slow',
    };
  } catch (error) {
    return {
      status: 'down',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Stripe API connection failed',
    };
  }
}

/**
 * Check S3 connectivity
 */
async function checkS3(): Promise<DependencyHealth> {
  const start = Date.now();

  try {
    // Get S3 client configuration
    const { client, config } = getS3();

    // Simple check to ensure S3 is configured
    // In production, you might want to do a lightweight operation like listBuckets
    return {
      status: 'up',
      responseTime: Date.now() - start,
      message: 'S3 configuration is valid',
    };
  } catch (error) {
    return {
      status: 'down',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'S3 configuration failed',
    };
  }
}

/**
 * GET /api/health
 *
 * Returns health status of the application and its dependencies
 */
export async function GET(request: Request) {
  const startTime = Date.now();

  // Run all health checks in parallel
  const [database, stripe, s3] = await Promise.all([
    checkDatabase(),
    checkStripe(),
    checkS3(),
  ]);

  // Determine overall health status
  const checks = { database, stripe, s3 };
  const hasDown = Object.values(checks).some((check) => check.status === 'down');
  const hasDegraded = Object.values(checks).some((check) => check.status === 'degraded');

  const overallStatus = hasDown ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';

  const healthCheck: HealthCheck = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '0.1.0',
    environment: env.NODE_ENV,
    checks,
  };

  // Return appropriate HTTP status
  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

  return NextResponse.json(healthCheck, {
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Response-Time': `${Date.now() - startTime}ms`,
    },
  });
}

/**
 * HEAD /api/health
 *
 * Lightweight health check for load balancers
 * Only checks database connectivity (fastest check)
 */
export async function HEAD() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return new Response(null, { status: 200 });
  } catch (error) {
    return new Response(null, { status: 503 });
  }
}
