import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * Create a Prisma Client instance with optimized configuration
 *
 * Connection Pooling:
 * - PostgreSQL default: 10 connections per Prisma Client instance
 * - In serverless: use connection pooler (e.g., PgBouncer, Supabase pooler)
 * - Set connection_limit in DATABASE_URL for custom pool size
 *
 * Example DATABASE_URL:
 * postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20
 */
function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],

    // Error formatting for better debugging
    errorFormat: process.env.NODE_ENV === 'development' ? 'pretty' : 'minimal',

    // Connection pool configuration (via datasource in schema)
    // Additional config can be done via DATABASE_URL query parameters:
    // - connection_limit: max connections (default: num_physical_cpus * 2 + 1)
    // - pool_timeout: seconds to wait for connection (default: 10)
    // - connect_timeout: seconds to wait for initial connection (default: 5)
  });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

// Prevent multiple instances in development (hot reload)
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Graceful shutdown - close database connections properly
 * Call this on process exit to prevent connection leaks
 */
export async function disconnectPrisma() {
  await prisma.$disconnect();
}

/**
 * Health check - verify database connectivity
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Handle process termination gracefully
if (process.env.NODE_ENV === 'production') {
  process.on('beforeExit', async () => {
    console.log('Disconnecting Prisma Client...');
    await disconnectPrisma();
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, disconnecting Prisma Client...');
    await disconnectPrisma();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, disconnecting Prisma Client...');
    await disconnectPrisma();
    process.exit(0);
  });
}

export * from '@prisma/client';
