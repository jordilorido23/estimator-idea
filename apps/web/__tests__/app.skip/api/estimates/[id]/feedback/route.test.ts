import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/estimates/[id]/feedback/route';
import { prisma } from '@scopeguard/db';
import { auth } from '@clerk/nextjs/server';

vi.mock('@scopeguard/db');
vi.mock('@clerk/nextjs/server');

// Mock Decimal class for testing
class Decimal {
  value: number;

  constructor(value: number | string) {
    this.value = typeof value === 'string' ? parseFloat(value) : value;
  }

  toNumber() {
    return this.value;
  }

  minus(other: Decimal | number) {
    const otherValue = other instanceof Decimal ? other.value : other;
    return new Decimal(this.value - otherValue);
  }

  div(other: Decimal | number) {
    const otherValue = other instanceof Decimal ? other.value : other;
    return new Decimal(this.value / otherValue);
  }

  mul(other: Decimal | number) {
    const otherValue = other instanceof Decimal ? other.value : other;
    return new Decimal(this.value * otherValue);
  }
}

describe('POST /api/estimates/[id]/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to authenticated user
    vi.mocked(auth).mockResolvedValue({
      userId: 'user_test123',
      sessionId: 'session_test123',
    } as any);
  });

  const mockEstimate = {
    id: 'estimate_123',
    total: new Decimal(15000),
    lead: {
      contractorId: 'contractor_123',
      contractor: {
        users: [
          {
            clerkUserId: 'user_test123',
          },
        ],
      },
    },
  };

  const createMockRequest = (body: any) => {
    return {
      json: vi.fn().mockResolvedValue(body),
    } as any;
  };

  const createParams = (id: string) => ({
    params: { id },
  });

  describe('variance calculations', () => {
    it('should calculate positive variance correctly', async () => {
      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(mockEstimate as any);
      vi.mocked(prisma.estimate.update).mockResolvedValue({} as any);

      const request = createMockRequest({
        projectOutcome: 'WON',
        actualCost: 16000, // $1000 over estimate
      });

      await POST(request, createParams('estimate_123'));

      const updateCall = vi.mocked(prisma.estimate.update).mock.calls[0][0];

      // Variance = actualCost - total = 16000 - 15000 = 1000
      expect(updateCall.data.variance).toBeInstanceOf(Decimal);
      expect((updateCall.data.variance as Decimal).toNumber()).toBe(1000);

      // Variance % = (1000 / 15000) * 100 = 6.67%
      expect(updateCall.data.variancePercent).toBeInstanceOf(Decimal);
      expect((updateCall.data.variancePercent as Decimal).toNumber()).toBeCloseTo(6.67, 2);
    });

    it('should calculate negative variance correctly', async () => {
      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(mockEstimate as any);
      vi.mocked(prisma.estimate.update).mockResolvedValue({} as any);

      const request = createMockRequest({
        projectOutcome: 'WON',
        actualCost: 14000, // $1000 under estimate
      });

      await POST(request, createParams('estimate_123'));

      const updateCall = vi.mocked(prisma.estimate.update).mock.calls[0][0];

      // Variance = actualCost - total = 14000 - 15000 = -1000
      expect((updateCall.data.variance as Decimal).toNumber()).toBe(-1000);

      // Variance % = (-1000 / 15000) * 100 = -6.67%
      expect((updateCall.data.variancePercent as Decimal).toNumber()).toBeCloseTo(-6.67, 2);
    });

    it('should calculate zero variance when actual equals estimate', async () => {
      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(mockEstimate as any);
      vi.mocked(prisma.estimate.update).mockResolvedValue({} as any);

      const request = createMockRequest({
        projectOutcome: 'WON',
        actualCost: 15000, // Exact match
      });

      await POST(request, createParams('estimate_123'));

      const updateCall = vi.mocked(prisma.estimate.update).mock.calls[0][0];

      expect((updateCall.data.variance as Decimal).toNumber()).toBe(0);
      expect((updateCall.data.variancePercent as Decimal).toNumber()).toBe(0);
    });

    it('should handle large variance correctly', async () => {
      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(mockEstimate as any);
      vi.mocked(prisma.estimate.update).mockResolvedValue({} as any);

      const request = createMockRequest({
        projectOutcome: 'WON',
        actualCost: 30000, // Double the estimate
      });

      await POST(request, createParams('estimate_123'));

      const updateCall = vi.mocked(prisma.estimate.update).mock.calls[0][0];

      // Variance = 30000 - 15000 = 15000
      expect((updateCall.data.variance as Decimal).toNumber()).toBe(15000);

      // Variance % = (15000 / 15000) * 100 = 100%
      expect((updateCall.data.variancePercent as Decimal).toNumber()).toBe(100);
    });

    it('should handle decimal precision in variance calculations', async () => {
      const estimateWithDecimals = {
        ...mockEstimate,
        total: new Decimal(15432.87),
      };

      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(estimateWithDecimals as any);
      vi.mocked(prisma.estimate.update).mockResolvedValue({} as any);

      const request = createMockRequest({
        projectOutcome: 'WON',
        actualCost: 15789.45,
      });

      await POST(request, createParams('estimate_123'));

      const updateCall = vi.mocked(prisma.estimate.update).mock.calls[0][0];

      // Variance = 15789.45 - 15432.87 = 356.58
      expect((updateCall.data.variance as Decimal).toNumber()).toBeCloseTo(356.58, 2);

      // Variance % = (356.58 / 15432.87) * 100 ≈ 2.31%
      expect((updateCall.data.variancePercent as Decimal).toNumber()).toBeCloseTo(2.31, 2);
    });

    it('should set variance to null when actualCost is not provided', async () => {
      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(mockEstimate as any);
      vi.mocked(prisma.estimate.update).mockResolvedValue({} as any);

      const request = createMockRequest({
        projectOutcome: 'LOST',
        // No actualCost
      });

      await POST(request, createParams('estimate_123'));

      const updateCall = vi.mocked(prisma.estimate.update).mock.calls[0][0];

      expect(updateCall.data.variance).toBeNull();
      expect(updateCall.data.variancePercent).toBeNull();
    });

    it('should set variance to null when actualCost is explicitly null', async () => {
      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(mockEstimate as any);
      vi.mocked(prisma.estimate.update).mockResolvedValue({} as any);

      const request = createMockRequest({
        projectOutcome: 'CANCELLED',
        actualCost: null,
      });

      await POST(request, createParams('estimate_123'));

      const updateCall = vi.mocked(prisma.estimate.update).mock.calls[0][0];

      expect(updateCall.data.variance).toBeNull();
      expect(updateCall.data.variancePercent).toBeNull();
    });

    it('should handle zero total estimate edge case', async () => {
      const zeroEstimate = {
        ...mockEstimate,
        total: new Decimal(0),
      };

      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(zeroEstimate as any);
      vi.mocked(prisma.estimate.update).mockResolvedValue({} as any);

      const request = createMockRequest({
        projectOutcome: 'WON',
        actualCost: 1000,
      });

      await POST(request, createParams('estimate_123'));

      const updateCall = vi.mocked(prisma.estimate.update).mock.calls[0][0];

      // Variance = 1000 - 0 = 1000
      expect((updateCall.data.variance as Decimal).toNumber()).toBe(1000);

      // Cannot calculate percentage when total is 0, should be null
      expect(updateCall.data.variancePercent).toBeNull();
    });
  });

  describe('authorization', () => {
    it('should return 401 if user is not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      const request = createMockRequest({
        projectOutcome: 'WON',
        actualCost: 15000,
      });

      const response = await POST(request, createParams('estimate_123'));

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('should return 404 if estimate not found', async () => {
      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(null);

      const request = createMockRequest({
        projectOutcome: 'WON',
        actualCost: 15000,
      });

      const response = await POST(request, createParams('nonexistent_id'));

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('not found');
    });

    it('should verify estimate belongs to authenticated user contractor', async () => {
      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(mockEstimate as any);
      vi.mocked(prisma.estimate.update).mockResolvedValue({} as any);

      const request = createMockRequest({
        projectOutcome: 'WON',
        actualCost: 15000,
      });

      await POST(request, createParams('estimate_123'));

      expect(prisma.estimate.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'estimate_123',
          lead: {
            contractorId: {
              not: null,
            },
            contractor: {
              users: {
                some: {
                  clerkUserId: 'user_test123',
                },
              },
            },
          },
        },
        include: {
          lead: true,
        },
      });
    });

    it('should reject if user does not belong to contractor', async () => {
      const unauthorizedEstimate = {
        ...mockEstimate,
        lead: {
          contractorId: 'contractor_456',
          contractor: {
            users: [
              {
                clerkUserId: 'different_user',
              },
            ],
          },
        },
      };

      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(null); // Filtered out by auth check

      const request = createMockRequest({
        projectOutcome: 'WON',
        actualCost: 15000,
      });

      const response = await POST(request, createParams('estimate_123'));

      expect(response.status).toBe(404);
    });
  });

  describe('data updates', () => {
    it('should update projectOutcome', async () => {
      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(mockEstimate as any);
      vi.mocked(prisma.estimate.update).mockResolvedValue({} as any);

      const request = createMockRequest({
        projectOutcome: 'WON',
        actualCost: 15000,
      });

      await POST(request, createParams('estimate_123'));

      const updateCall = vi.mocked(prisma.estimate.update).mock.calls[0][0];
      expect(updateCall.data.projectOutcome).toBe('WON');
    });

    it('should update actualCost as Decimal', async () => {
      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(mockEstimate as any);
      vi.mocked(prisma.estimate.update).mockResolvedValue({} as any);

      const request = createMockRequest({
        projectOutcome: 'WON',
        actualCost: 15500.75,
      });

      await POST(request, createParams('estimate_123'));

      const updateCall = vi.mocked(prisma.estimate.update).mock.calls[0][0];
      expect(updateCall.data.actualCost).toBeInstanceOf(Decimal);
      expect((updateCall.data.actualCost as Decimal).toNumber()).toBe(15500.75);
    });

    it('should update completedAt as Date', async () => {
      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(mockEstimate as any);
      vi.mocked(prisma.estimate.update).mockResolvedValue({} as any);

      const completedDate = '2024-02-15T10:00:00.000Z';
      const request = createMockRequest({
        projectOutcome: 'WON',
        actualCost: 15000,
        completedAt: completedDate,
      });

      await POST(request, createParams('estimate_123'));

      const updateCall = vi.mocked(prisma.estimate.update).mock.calls[0][0];
      expect(updateCall.data.completedAt).toBeInstanceOf(Date);
      expect(updateCall.data.completedAt).toEqual(new Date(completedDate));
    });

    it('should set completedAt to null when not provided', async () => {
      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(mockEstimate as any);
      vi.mocked(prisma.estimate.update).mockResolvedValue({} as any);

      const request = createMockRequest({
        projectOutcome: 'WON',
        actualCost: 15000,
      });

      await POST(request, createParams('estimate_123'));

      const updateCall = vi.mocked(prisma.estimate.update).mock.calls[0][0];
      expect(updateCall.data.completedAt).toBeNull();
    });

    it('should update feedbackNotes', async () => {
      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(mockEstimate as any);
      vi.mocked(prisma.estimate.update).mockResolvedValue({} as any);

      const request = createMockRequest({
        projectOutcome: 'WON',
        actualCost: 15000,
        feedbackNotes: 'Project completed on time',
      });

      await POST(request, createParams('estimate_123'));

      const updateCall = vi.mocked(prisma.estimate.update).mock.calls[0][0];
      expect(updateCall.data.feedbackNotes).toBe('Project completed on time');
    });

    it('should update the correct estimate by ID', async () => {
      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(mockEstimate as any);
      vi.mocked(prisma.estimate.update).mockResolvedValue({} as any);

      const request = createMockRequest({
        projectOutcome: 'WON',
        actualCost: 15000,
      });

      await POST(request, createParams('estimate_456'));

      const updateCall = vi.mocked(prisma.estimate.update).mock.calls[0][0];
      expect(updateCall.where.id).toBe('estimate_456');
    });
  });

  describe('validation', () => {
    it('should return 422 for invalid projectOutcome', async () => {
      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(mockEstimate as any);

      const request = createMockRequest({
        projectOutcome: 'INVALID_STATUS',
        actualCost: 15000,
      });

      const response = await POST(request, createParams('estimate_123'));

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toBe('Validation error');
    });

    it('should return 422 for negative actualCost', async () => {
      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(mockEstimate as any);

      const request = createMockRequest({
        projectOutcome: 'WON',
        actualCost: -1000,
      });

      const response = await POST(request, createParams('estimate_123'));

      expect(response.status).toBe(422);
    });

    it('should return 422 for zero actualCost', async () => {
      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(mockEstimate as any);

      const request = createMockRequest({
        projectOutcome: 'WON',
        actualCost: 0,
      });

      const response = await POST(request, createParams('estimate_123'));

      expect(response.status).toBe(422);
    });

    it('should return 422 for invalid completedAt format', async () => {
      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(mockEstimate as any);

      const request = createMockRequest({
        projectOutcome: 'WON',
        actualCost: 15000,
        completedAt: '2024-02-15', // Invalid: needs time
      });

      const response = await POST(request, createParams('estimate_123'));

      expect(response.status).toBe(422);
    });
  });

  describe('response handling', () => {
    it('should return success response with updated estimate', async () => {
      const updatedEstimate = {
        id: 'estimate_123',
        projectOutcome: 'WON',
        actualCost: new Decimal(15000),
        variance: new Decimal(0),
        variancePercent: new Decimal(0),
      };

      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(mockEstimate as any);
      vi.mocked(prisma.estimate.update).mockResolvedValue(updatedEstimate as any);

      const request = createMockRequest({
        projectOutcome: 'WON',
        actualCost: 15000,
      });

      const response = await POST(request, createParams('estimate_123'));

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    it('should handle database update errors', async () => {
      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(mockEstimate as any);
      vi.mocked(prisma.estimate.update).mockRejectedValue(
        new Error('Database error')
      );

      const request = createMockRequest({
        projectOutcome: 'WON',
        actualCost: 15000,
      });

      const response = await POST(request, createParams('estimate_123'));

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to save feedback');
    });
  });

  describe('different project outcomes', () => {
    it('should handle LOST outcome without actualCost', async () => {
      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(mockEstimate as any);
      vi.mocked(prisma.estimate.update).mockResolvedValue({} as any);

      const request = createMockRequest({
        projectOutcome: 'LOST',
        feedbackNotes: 'Lost to competitor',
      });

      const response = await POST(request, createParams('estimate_123'));

      expect(response.status).toBe(200);

      const updateCall = vi.mocked(prisma.estimate.update).mock.calls[0][0];
      expect(updateCall.data.projectOutcome).toBe('LOST');
      expect(updateCall.data.actualCost).toBeNull();
      expect(updateCall.data.variance).toBeNull();
    });

    it('should handle CANCELLED outcome', async () => {
      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(mockEstimate as any);
      vi.mocked(prisma.estimate.update).mockResolvedValue({} as any);

      const request = createMockRequest({
        projectOutcome: 'CANCELLED',
        feedbackNotes: 'Homeowner cancelled project',
      });

      const response = await POST(request, createParams('estimate_123'));

      expect(response.status).toBe(200);

      const updateCall = vi.mocked(prisma.estimate.update).mock.calls[0][0];
      expect(updateCall.data.projectOutcome).toBe('CANCELLED');
    });

    it('should handle IN_PROGRESS outcome', async () => {
      vi.mocked(prisma.estimate.findFirst).mockResolvedValue(mockEstimate as any);
      vi.mocked(prisma.estimate.update).mockResolvedValue({} as any);

      const request = createMockRequest({
        projectOutcome: 'IN_PROGRESS',
        feedbackNotes: 'Work has begun',
      });

      const response = await POST(request, createParams('estimate_123'));

      expect(response.status).toBe(200);

      const updateCall = vi.mocked(prisma.estimate.update).mock.calls[0][0];
      expect(updateCall.data.projectOutcome).toBe('IN_PROGRESS');
    });
  });
});
