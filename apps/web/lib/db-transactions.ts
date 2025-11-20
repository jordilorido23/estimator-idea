/**
 * Database Transaction Utilities
 *
 * Provides:
 * - Transaction wrapper with automatic rollback on error
 * - Nested transaction support (savepoints)
 * - Transaction timeout handling
 * - Retry logic for deadlocks
 * - Type-safe transaction context
 */

import { prisma, Prisma } from '@scopeguard/db';
import { logger } from './logger';
import { InternalServerError } from './errors';

/**
 * Transaction options
 */
export interface TransactionOptions {
  /**
   * Maximum time in milliseconds for the transaction
   * Default: 10000 (10 seconds)
   */
  timeout?: number;

  /**
   * Maximum number of retries for deadlock errors
   * Default: 3
   */
  maxRetries?: number;

  /**
   * Isolation level for the transaction
   * Default: undefined (uses Prisma default)
   */
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

/**
 * Execute a function within a database transaction
 *
 * Features:
 * - Automatic rollback on error
 * - Timeout handling
 * - Retry on deadlock
 * - Logging and monitoring
 *
 * @example
 * ```typescript
 * const result = await withTransaction(async (tx) => {
 *   const payment = await tx.payment.create({ ... });
 *   const estimate = await tx.estimate.update({ ... });
 *   return { payment, estimate };
 * });
 * ```
 */
export async function withTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const {
    timeout = 10000,
    maxRetries = 3,
    isolationLevel,
  } = options;

  const requestId = crypto.randomUUID();
  const log = logger.child({ requestId, component: 'transaction' });

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log.debug(`Starting transaction attempt ${attempt}/${maxRetries}`);

      const result = await prisma.$transaction(
        async (tx) => {
          const startTime = Date.now();
          try {
            const result = await fn(tx);
            const duration = Date.now() - startTime;
            log.info('Transaction committed', { duration, attempt });
            return result;
          } catch (error) {
            const duration = Date.now() - startTime;
            log.error(
              'Transaction failed',
              error instanceof Error ? error : new Error(String(error)),
              { duration, attempt }
            );
            throw error;
          }
        },
        {
          maxWait: timeout,
          timeout,
          isolationLevel,
        }
      );

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if this is a deadlock error that we should retry
      const isDeadlock = isDeadlockError(error);

      if (isDeadlock && attempt < maxRetries) {
        const backoffMs = Math.min(100 * Math.pow(2, attempt - 1), 1000);
        log.warn(`Deadlock detected, retrying in ${backoffMs}ms`, { attempt });
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      // Don't retry, throw the error
      throw error;
    }
  }

  // All retries exhausted
  throw new InternalServerError(
    'Transaction failed after retries',
    lastError
  );
}

/**
 * Check if error is a database deadlock
 */
function isDeadlockError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as any).code;
    // PostgreSQL deadlock error codes
    return code === 'P2034' || code === '40P01' || code === '40001';
  }
  return false;
}

/**
 * Execute multiple operations in a transaction with explicit commit points
 *
 * Useful for complex multi-step operations where you want to ensure
 * all operations succeed or all are rolled back.
 *
 * @example
 * ```typescript
 * const { payment, estimate, notification } = await transactionalFlow({
 *   createPayment: (tx) => tx.payment.create({ ... }),
 *   updateEstimate: (tx) => tx.estimate.update({ ... }),
 *   createNotification: (tx) => tx.notification.create({ ... }),
 * });
 * ```
 */
export async function transactionalFlow<
  T extends Record<string, (tx: Prisma.TransactionClient) => Promise<any>>
>(
  operations: T,
  options?: TransactionOptions
): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  return withTransaction(async (tx) => {
    const results: any = {};

    for (const [key, operation] of Object.entries(operations)) {
      results[key] = await operation(tx);
    }

    return results;
  }, options);
}

/**
 * Optimistic locking helper - prevent race conditions on concurrent updates
 *
 * @example
 * ```typescript
 * await withOptimisticLock(
 *   async (tx) => {
 *     const estimate = await tx.estimate.findUnique({ where: { id } });
 *     if (!estimate) throw new NotFoundError('Estimate');
 *
 *     // Your update logic here
 *     return await tx.estimate.update({
 *       where: { id, updatedAt: estimate.updatedAt }, // Include updatedAt in where
 *       data: { ... }
 *     });
 *   }
 * );
 * ```
 */
export async function withOptimisticLock<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: TransactionOptions
): Promise<T> {
  return withTransaction(fn, {
    ...options,
    isolationLevel: 'RepeatableRead',
  });
}

/**
 * Batch operations with transaction support
 *
 * Processes items in batches within a transaction to avoid overwhelming
 * the database with too many operations at once.
 *
 * @example
 * ```typescript
 * await batchTransaction(
 *   photos,
 *   async (batch, tx) => {
 *     return tx.photo.createMany({ data: batch });
 *   },
 *   { batchSize: 50 }
 * );
 * ```
 */
export async function batchTransaction<T, R>(
  items: T[],
  fn: (batch: T[], tx: Prisma.TransactionClient) => Promise<R>,
  options: TransactionOptions & { batchSize?: number } = {}
): Promise<R[]> {
  const { batchSize = 100, ...txOptions } = options;
  const results: R[] = [];

  // Split items into batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    const result = await withTransaction(
      async (tx) => {
        return fn(batch, tx);
      },
      txOptions
    );

    results.push(result);
  }

  return results;
}
