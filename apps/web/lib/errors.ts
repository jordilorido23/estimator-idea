/**
 * Centralized Error Handling System
 *
 * This module provides:
 * - Standard error classes with HTTP status codes
 * - Error response formatting
 * - Error logging with context
 * - Production-safe error messages
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = 'INTERNAL_ERROR',
    public readonly isOperational: boolean = true,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 - Bad Request
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request', details?: unknown) {
    super(message, 400, 'BAD_REQUEST', true, details);
  }
}

/**
 * 401 - Unauthorized
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED', true);
  }
}

/**
 * 403 - Forbidden
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'FORBIDDEN', true);
  }
}

/**
 * 404 - Not Found
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND', true);
  }
}

/**
 * 409 - Conflict
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict', details?: unknown) {
    super(message, 409, 'CONFLICT', true, details);
  }
}

/**
 * 422 - Unprocessable Entity (Validation Error)
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR', true, details);
  }
}

/**
 * 429 - Too Many Requests
 */
export class RateLimitError extends AppError {
  constructor(
    message: string = 'Too many requests',
    public readonly retryAfter?: number
  ) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', true);
  }
}

/**
 * 500 - Internal Server Error
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', details?: unknown) {
    super(message, 500, 'INTERNAL_ERROR', false, details);
  }
}

/**
 * 502 - Bad Gateway (External Service Error)
 */
export class ExternalServiceError extends AppError {
  constructor(
    service: string,
    message: string = 'External service error',
    details?: unknown
  ) {
    super(`${service}: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', true, details);
  }
}

/**
 * 503 - Service Unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE', true);
  }
}

/**
 * Error response interface
 */
interface ErrorResponse {
  error: {
    message: string;
    code: string;
    statusCode: number;
    details?: unknown;
    requestId?: string;
  };
}

/**
 * Format error for API response
 * - In production, hide internal error details
 * - In development, show full error information
 */
export function formatErrorResponse(
  error: unknown,
  requestId?: string
): ErrorResponse {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return {
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: 422,
        details: isDevelopment ? error.flatten() : undefined,
        requestId,
      },
    };
  }

  // Handle our custom AppError instances
  if (error instanceof AppError) {
    return {
      error: {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        details: isDevelopment ? error.details : undefined,
        requestId,
      },
    };
  }

  // Handle unknown errors
  console.error('Unexpected error:', error);

  return {
    error: {
      message: isDevelopment
        ? error instanceof Error
          ? error.message
          : 'An unexpected error occurred'
        : 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      details: isDevelopment && error instanceof Error ? error.stack : undefined,
      requestId,
    },
  };
}

/**
 * Create NextResponse from error
 */
export function errorToResponse(error: unknown, requestId?: string): NextResponse {
  const errorResponse = formatErrorResponse(error, requestId);
  const statusCode = errorResponse.error.statusCode;

  // Add retry-after header for rate limit errors
  const headers: HeadersInit = {};
  if (error instanceof RateLimitError && error.retryAfter) {
    headers['Retry-After'] = error.retryAfter.toString();
  }

  return NextResponse.json(errorResponse, {
    status: statusCode,
    headers,
  });
}

/**
 * Log error with context
 */
export function logError(
  error: unknown,
  context: {
    requestId?: string;
    userId?: string;
    path?: string;
    method?: string;
    [key: string]: unknown;
  }
) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (error instanceof AppError) {
    // Only log non-operational errors as errors (operational = expected, like 404)
    if (error.isOperational) {
      console.warn('Operational error:', {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        ...context,
      });
    } else {
      console.error('Application error:', {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        stack: isDevelopment ? error.stack : undefined,
        details: error.details,
        ...context,
      });
    }
  } else {
    // Unexpected errors are always logged as errors
    console.error('Unexpected error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: isDevelopment && error instanceof Error ? error.stack : undefined,
      ...context,
    });
  }
}

/**
 * Safe async route handler wrapper
 * Catches all errors and returns proper HTTP responses
 *
 * @example
 * ```typescript
 * export const POST = asyncHandler(async (request) => {
 *   const body = await request.json();
 *   // ... your logic
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
export function asyncHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      // Generate request ID for tracking
      const requestId = crypto.randomUUID();

      // Extract request context
      const request = args[0] as Request | undefined;
      const context = {
        requestId,
        path: request?.url,
        method: request?.method,
      };

      // Log the error
      logError(error, context);

      // Return formatted error response
      return errorToResponse(error, requestId);
    }
  }) as T;
}
