/**
 * AI API Retry Logic and Circuit Breaker
 *
 * This module provides:
 * - Exponential backoff retry for transient failures
 * - Circuit breaker pattern to prevent cascade failures
 * - Timeout handling for long-running requests
 * - Structured error handling with proper logging
 */

export class AIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = true,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export class AITimeoutError extends AIError {
  constructor(timeoutMs: number) {
    super(`AI request timed out after ${timeoutMs}ms`, 'AI_TIMEOUT', true);
    this.name = 'AITimeoutError';
  }
}

export class AIRateLimitError extends AIError {
  constructor(retryAfter?: number) {
    super(
      `AI API rate limit exceeded${retryAfter ? `, retry after ${retryAfter}s` : ''}`,
      'AI_RATE_LIMIT',
      true
    );
    this.name = 'AIRateLimitError';
  }
}

export class AICircuitBreakerError extends AIError {
  constructor() {
    super('AI service circuit breaker is open - too many recent failures', 'CIRCUIT_OPEN', false);
    this.name = 'AICircuitBreakerError';
  }
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts?: number; // Default: 3
  initialDelayMs?: number; // Default: 1000
  maxDelayMs?: number; // Default: 10000
  timeoutMs?: number; // Default: 30000 (30 seconds)
  backoffMultiplier?: number; // Default: 2
}

/**
 * Circuit breaker state
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime?: number;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private readonly failureThreshold = 5,
    private readonly cooldownMs = 60000 // 1 minute
  ) {}

  isOpen(): boolean {
    if (this.state === 'OPEN') {
      // Check if we should transition to HALF_OPEN
      if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.cooldownMs) {
        console.log('Circuit breaker transitioning to HALF_OPEN');
        this.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      console.log('Circuit breaker CLOSED after successful request');
      this.state = 'CLOSED';
    }
  }

  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold && this.state !== 'OPEN') {
      console.error(`Circuit breaker OPEN after ${this.failures} failures`);
      this.state = 'OPEN';
    }
  }

  getState(): string {
    return this.state;
  }
}

/**
 * Global circuit breaker for AI services
 */
const aiCircuitBreaker = new CircuitBreaker(5, 60000);

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoff(attempt: number, config: Required<RetryConfig>): number {
  const exponentialDelay = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
    config.maxDelayMs
  );

  // Add jitter (±20%) to prevent thundering herd
  const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1);

  return Math.floor(exponentialDelay + jitter);
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine if error is retryable based on error type
 */
function isRetryableError(error: unknown): boolean {
  // Anthropic SDK errors
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as any).status;
    // Retry on 429 (rate limit), 500, 502, 503, 504
    return [429, 500, 502, 503, 504].includes(status);
  }

  // Network errors are generally retryable
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('enotfound')
    );
  }

  return false;
}

/**
 * Execute a function with timeout
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new AITimeoutError(timeoutMs)), timeoutMs)
    ),
  ]);
}

/**
 * Retry an AI API call with exponential backoff and circuit breaker
 *
 * @param fn - Async function to execute (the AI API call)
 * @param config - Retry configuration
 * @returns Result from the AI API call
 * @throws AIError or subclass if all retries fail
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   () => client.messages.create({ ... }),
 *   { maxAttempts: 3, timeoutMs: 30000 }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  userConfig: RetryConfig = {}
): Promise<T> {
  const config: Required<RetryConfig> = {
    maxAttempts: userConfig.maxAttempts ?? 3,
    initialDelayMs: userConfig.initialDelayMs ?? 1000,
    maxDelayMs: userConfig.maxDelayMs ?? 10000,
    timeoutMs: userConfig.timeoutMs ?? 30000,
    backoffMultiplier: userConfig.backoffMultiplier ?? 2,
  };

  // Check circuit breaker before attempting
  if (aiCircuitBreaker.isOpen()) {
    throw new AICircuitBreakerError();
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      console.log(
        `AI API attempt ${attempt}/${config.maxAttempts} (circuit: ${aiCircuitBreaker.getState()})`
      );

      // Execute with timeout
      const result = await withTimeout(fn(), config.timeoutMs);

      // Success! Record it and return
      aiCircuitBreaker.recordSuccess();
      return result;
    } catch (error) {
      lastError = error;

      // Check if this is a rate limit error
      if (error && typeof error === 'object' && 'status' in error && (error as any).status === 429) {
        console.warn(`AI API rate limit hit on attempt ${attempt}`);
        const retryAfter = (error as any).headers?.['retry-after'];
        lastError = new AIRateLimitError(retryAfter ? parseInt(retryAfter) : undefined);
      }

      // Check if error is retryable
      const retryable = isRetryableError(error);

      console.error(`AI API attempt ${attempt} failed:`, {
        error: error instanceof Error ? error.message : String(error),
        retryable,
      });

      // If it's the last attempt or non-retryable, record failure and throw
      if (attempt === config.maxAttempts || !retryable) {
        aiCircuitBreaker.recordFailure();

        if (error instanceof AIError) {
          throw error;
        }

        throw new AIError(
          `AI API call failed after ${attempt} attempt(s): ${error instanceof Error ? error.message : String(error)}`,
          'AI_FAILURE',
          retryable,
          error
        );
      }

      // Calculate backoff and wait before retry
      const delayMs = calculateBackoff(attempt, config);
      console.log(`Retrying AI API call in ${delayMs}ms...`);
      await sleep(delayMs);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new AIError(
    'AI API call failed unexpectedly',
    'AI_UNKNOWN_FAILURE',
    false,
    lastError
  );
}

/**
 * Get current circuit breaker state for monitoring
 */
export function getCircuitBreakerState(): string {
  return aiCircuitBreaker.getState();
}

/**
 * Reset circuit breaker (for testing or manual intervention)
 */
export function resetCircuitBreaker(): void {
  aiCircuitBreaker.recordSuccess();
}
