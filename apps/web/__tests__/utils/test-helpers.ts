import { vi } from 'vitest';
import type { Mock } from 'vitest';

/**
 * Test helper utilities for mocking external services and creating test data
 */

/**
 * Mock Prisma Client
 */
export const createMockPrismaClient = () => {
  return {
    contractor: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    lead: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    photo: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    takeoff: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    estimate: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      update: vi.fn(),
    },
  };
};

/**
 * Mock Clerk authentication
 */
export const mockClerkAuth = (userId: string | null = 'user_test123') => {
  return {
    auth: vi.fn().mockResolvedValue({
      userId,
      sessionId: userId ? 'session_test123' : null,
    }),
  };
};

/**
 * Mock Anthropic API response
 */
export const createMockAnthropicResponse = (content: string) => {
  return {
    id: 'msg_test123',
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: content,
      },
    ],
    model: 'claude-3-5-sonnet-20241022',
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 100,
      output_tokens: 50,
    },
  };
};

/**
 * Mock Resend email client
 */
export const createMockResendClient = () => {
  const mockSend = vi.fn().mockResolvedValue({ id: 'email_test123' });

  return {
    Resend: vi.fn(function (this: any) {
      this.emails = { send: mockSend };
      return this;
    }),
    mockSend,
  };
};

/**
 * Mock S3 Client
 */
export const createMockS3Client = () => {
  return {
    send: vi.fn(),
  };
};

/**
 * Mock Stripe
 */
export const createMockStripeClient = () => {
  return {
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  };
};

/**
 * Create mock NextRequest
 */
export const createMockRequest = (options: {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  url?: string;
}) => {
  const { method = 'GET', body, headers = {}, url = 'http://localhost:3000' } = options;

  return {
    method,
    json: vi.fn().mockResolvedValue(body),
    headers: new Headers(headers),
    url,
  } as any;
};

/**
 * Create mock NextResponse matcher
 */
export const expectJsonResponse = (response: any, expectedStatus: number, expectedData?: any) => {
  expect(response.status).toBe(expectedStatus);
  if (expectedData) {
    expect(response).toMatchObject(expectedData);
  }
};

/**
 * Decimal test helper - creates Decimal-like objects for testing
 */
export const createDecimal = (value: number) => {
  return {
    toNumber: () => value,
    toString: () => value.toString(),
    valueOf: () => value,
  };
};

/**
 * Wait for async operations
 */
export const waitFor = (ms: number = 100) => new Promise(resolve => setTimeout(resolve, ms));
