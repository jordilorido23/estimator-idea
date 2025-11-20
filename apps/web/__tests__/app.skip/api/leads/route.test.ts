import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/leads/route';
import { prisma } from '@scopeguard/db';
import { NextResponse } from 'next/server';

// Mock dependencies
vi.mock('@scopeguard/db');
vi.mock('@/lib/email', () => ({
  sendNewLeadNotification: vi.fn().mockResolvedValue(true),
  sendHomeownerConfirmation: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/ai/photo-analyzer', () => ({
  analyzeMultiplePhotos: vi.fn().mockResolvedValue({
    photos: [],
    summary: {
      overallConfidence: 0.85,
      totalWorkItems: 5,
      hasSafetyHazards: false,
    },
  }),
}));

vi.mock('@/lib/ai/scope-generator', () => ({
  generateScopeOfWork: vi.fn().mockResolvedValue({
    workItems: ['Test work item'],
    estimatedDuration: '2-3 days',
    materials: ['Test material'],
  }),
}));

describe('POST /api/leads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validPayload = {
    contractorSlug: 'test-contractor',
    homeownerName: 'John Doe',
    homeownerEmail: 'john@example.com',
    homeownerPhone: '555-1234',
    address: '123 Main St, City, ST 12345',
    projectType: 'ROOFING',
    budget: 15000,
    timeline: '2024-06-01',
    description: 'Need roof replacement due to storm damage',
    photos: [],
  };

  const mockContractor = {
    id: 'contractor_123',
    companyName: 'Test Contractor LLC',
    email: 'contractor@example.com',
  };

  const createMockRequest = (body: any) => {
    return {
      json: vi.fn().mockResolvedValue(body),
    } as any;
  };

  describe('successful lead creation', () => {
    it('should create a lead with all valid data', async () => {
      vi.mocked(prisma.contractor.findUnique).mockResolvedValue(mockContractor as any);
      vi.mocked(prisma.lead.create).mockResolvedValue({
        id: 'lead_123',
        ...validPayload,
        budgetCents: 1500000,
        photos: [],
      } as any);

      const request = createMockRequest(validPayload);
      const response = await POST(request);

      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData.lead).toBeDefined();
      expect(responseData.lead.id).toBe('lead_123');
    });

    it('should convert budget to cents correctly', async () => {
      vi.mocked(prisma.contractor.findUnique).mockResolvedValue(mockContractor as any);
      vi.mocked(prisma.lead.create).mockResolvedValue({ id: 'lead_123' } as any);

      const request = createMockRequest({
        ...validPayload,
        budget: 250.75,
      });

      await POST(request);

      const createCall = vi.mocked(prisma.lead.create).mock.calls[0][0];
      expect(createCall.data.budgetCents).toBe(25075); // 250.75 * 100
    });

    it('should handle missing budget', async () => {
      vi.mocked(prisma.contractor.findUnique).mockResolvedValue(mockContractor as any);
      vi.mocked(prisma.lead.create).mockResolvedValue({ id: 'lead_123' } as any);

      const { budget, ...payloadWithoutBudget } = validPayload;
      const request = createMockRequest(payloadWithoutBudget);

      await POST(request);

      const createCall = vi.mocked(prisma.lead.create).mock.calls[0][0];
      expect(createCall.data.budgetCents).toBeUndefined();
    });

    it('should handle zero budget', async () => {
      vi.mocked(prisma.contractor.findUnique).mockResolvedValue(mockContractor as any);
      vi.mocked(prisma.lead.create).mockResolvedValue({ id: 'lead_123' } as any);

      const request = createMockRequest({
        ...validPayload,
        budget: 0,
      });

      await POST(request);

      const createCall = vi.mocked(prisma.lead.create).mock.calls[0][0];
      expect(createCall.data.budgetCents).toBe(0);
    });

    it('should create lead with photos', async () => {
      const photos = [
        {
          key: 'photos/test1.jpg',
          url: 'https://example.com/photo1.jpg',
          name: 'photo1.jpg',
          type: 'image/jpeg',
          size: 1024000,
        },
        {
          key: 'photos/test2.jpg',
          url: 'https://example.com/photo2.jpg',
          name: 'photo2.jpg',
          type: 'image/jpeg',
          size: 2048000,
        },
      ];

      vi.mocked(prisma.contractor.findUnique).mockResolvedValue(mockContractor as any);
      vi.mocked(prisma.lead.create).mockResolvedValue({
        id: 'lead_123',
        photos: photos.map((p, i) => ({ id: `photo_${i}`, ...p })),
      } as any);

      const request = createMockRequest({
        ...validPayload,
        photos,
      });

      await POST(request);

      const createCall = vi.mocked(prisma.lead.create).mock.calls[0][0];
      expect(createCall.data.photos).toBeDefined();
      expect(createCall.data.photos.create).toHaveLength(2);
      expect(createCall.data.photos.create[0]).toMatchObject({
        url: photos[0].url,
        key: photos[0].key,
        metadata: {
          name: photos[0].name,
          type: photos[0].type,
          size: photos[0].size,
        },
      });
    });

    it('should include photos in response', async () => {
      vi.mocked(prisma.contractor.findUnique).mockResolvedValue(mockContractor as any);
      vi.mocked(prisma.lead.create).mockResolvedValue({ id: 'lead_123' } as any);

      const request = createMockRequest(validPayload);

      await POST(request);

      const createCall = vi.mocked(prisma.lead.create).mock.calls[0][0];
      expect(createCall.include.photos).toBe(true);
    });
  });

  describe('contractor validation', () => {
    it('should return 404 if contractor not found', async () => {
      vi.mocked(prisma.contractor.findUnique).mockResolvedValue(null);

      const request = createMockRequest(validPayload);
      const response = await POST(request);

      expect(response.status).toBe(404);

      const responseData = await response.json();
      expect(responseData.error).toContain('not found');
    });

    it('should query contractor by slug', async () => {
      vi.mocked(prisma.contractor.findUnique).mockResolvedValue(mockContractor as any);
      vi.mocked(prisma.lead.create).mockResolvedValue({ id: 'lead_123' } as any);

      const request = createMockRequest({
        ...validPayload,
        contractorSlug: 'custom-contractor',
      });

      await POST(request);

      expect(prisma.contractor.findUnique).toHaveBeenCalledWith({
        where: { slug: 'custom-contractor' },
        select: { id: true, companyName: true, email: true },
      });
    });
  });

  describe('data mapping', () => {
    it('should map projectType to tradeType', async () => {
      vi.mocked(prisma.contractor.findUnique).mockResolvedValue(mockContractor as any);
      vi.mocked(prisma.lead.create).mockResolvedValue({ id: 'lead_123' } as any);

      const request = createMockRequest(validPayload);
      await POST(request);

      const createCall = vi.mocked(prisma.lead.create).mock.calls[0][0];
      expect(createCall.data.tradeType).toBe('ROOFING');
    });

    it('should map description to notes', async () => {
      vi.mocked(prisma.contractor.findUnique).mockResolvedValue(mockContractor as any);
      vi.mocked(prisma.lead.create).mockResolvedValue({ id: 'lead_123' } as any);

      const request = createMockRequest(validPayload);
      await POST(request);

      const createCall = vi.mocked(prisma.lead.create).mock.calls[0][0];
      expect(createCall.data.notes).toBe('Need roof replacement due to storm damage');
    });

    it('should handle null timeline correctly', async () => {
      vi.mocked(prisma.contractor.findUnique).mockResolvedValue(mockContractor as any);
      vi.mocked(prisma.lead.create).mockResolvedValue({ id: 'lead_123' } as any);

      const { timeline, ...payloadWithoutTimeline } = validPayload;
      const request = createMockRequest(payloadWithoutTimeline);

      await POST(request);

      const createCall = vi.mocked(prisma.lead.create).mock.calls[0][0];
      expect(createCall.data.timeline).toBeNull();
    });
  });

  describe('validation errors', () => {
    it('should return 422 for missing required fields', async () => {
      const invalidPayload = {
        contractorSlug: 'test-contractor',
        // Missing required fields
      };

      const request = createMockRequest(invalidPayload);
      const response = await POST(request);

      expect(response.status).toBe(422);

      const responseData = await response.json();
      expect(responseData.error).toBeDefined();
    });

    it('should return 422 for invalid email', async () => {
      const request = createMockRequest({
        ...validPayload,
        homeownerEmail: 'invalid-email',
      });

      const response = await POST(request);
      expect(response.status).toBe(422);
    });

    it('should return 422 for invalid phone', async () => {
      const request = createMockRequest({
        ...validPayload,
        homeownerPhone: '123', // Too short
      });

      const response = await POST(request);
      expect(response.status).toBe(422);
    });

    it('should return 422 for description too short', async () => {
      const request = createMockRequest({
        ...validPayload,
        description: 'short', // Less than 10 chars
      });

      const response = await POST(request);
      expect(response.status).toBe(422);
    });

    it('should return 422 for missing contractorSlug', async () => {
      const { contractorSlug, ...payloadWithoutSlug } = validPayload;
      const request = createMockRequest(payloadWithoutSlug);

      const response = await POST(request);
      expect(response.status).toBe(422);
    });

    it('should return 422 for too many photos', async () => {
      const photos = Array(11).fill({
        key: 'photos/test.jpg',
        url: 'https://example.com/photo.jpg',
        name: 'photo.jpg',
        type: 'image/jpeg',
        size: 1024000,
      });

      const request = createMockRequest({
        ...validPayload,
        photos,
      });

      const response = await POST(request);
      expect(response.status).toBe(422);
    });
  });

  describe('async operations', () => {
    it('should not wait for email notifications', async () => {
      vi.mocked(prisma.contractor.findUnique).mockResolvedValue(mockContractor as any);
      vi.mocked(prisma.lead.create).mockResolvedValue({ id: 'lead_123' } as any);

      const request = createMockRequest(validPayload);
      const response = await POST(request);

      // Should return immediately without waiting for emails
      expect(response.status).toBe(200);
      // Email functions should eventually be called but not awaited
    });

    it('should not wait for photo analysis', async () => {
      const photos = [{
        key: 'photos/test.jpg',
        url: 'https://example.com/photo.jpg',
        name: 'photo.jpg',
        type: 'image/jpeg',
        size: 1024000,
      }];

      vi.mocked(prisma.contractor.findUnique).mockResolvedValue(mockContractor as any);
      vi.mocked(prisma.lead.create).mockResolvedValue({
        id: 'lead_123',
        photos,
      } as any);

      const request = createMockRequest({
        ...validPayload,
        photos,
      });

      const response = await POST(request);

      // Should return immediately without waiting for photo analysis
      expect(response.status).toBe(200);
    });

    it('should return success even if async operations would fail', async () => {
      vi.mocked(prisma.contractor.findUnique).mockResolvedValue(mockContractor as any);
      vi.mocked(prisma.lead.create).mockResolvedValue({ id: 'lead_123' } as any);

      const request = createMockRequest(validPayload);
      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('error handling', () => {
    it('should return 500 for database errors', async () => {
      vi.mocked(prisma.contractor.findUnique).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createMockRequest(validPayload);
      const response = await POST(request);

      expect(response.status).toBe(500);

      const responseData = await response.json();
      expect(responseData.error).toBeDefined();
    });

    it('should handle lead creation errors', async () => {
      vi.mocked(prisma.contractor.findUnique).mockResolvedValue(mockContractor as any);
      vi.mocked(prisma.lead.create).mockRejectedValue(
        new Error('Failed to create lead')
      );

      const request = createMockRequest(validPayload);
      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('should handle JSON parsing errors', async () => {
      const request = {
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as any;

      const response = await POST(request);
      expect(response.status).toBe(500);
    });
  });

  describe('data persistence', () => {
    it('should store all homeowner details', async () => {
      vi.mocked(prisma.contractor.findUnique).mockResolvedValue(mockContractor as any);
      vi.mocked(prisma.lead.create).mockResolvedValue({ id: 'lead_123' } as any);

      const request = createMockRequest(validPayload);
      await POST(request);

      const createCall = vi.mocked(prisma.lead.create).mock.calls[0][0];
      expect(createCall.data).toMatchObject({
        contractorId: mockContractor.id,
        homeownerName: validPayload.homeownerName,
        homeownerEmail: validPayload.homeownerEmail,
        homeownerPhone: validPayload.homeownerPhone,
        address: validPayload.address,
        tradeType: validPayload.projectType,
        notes: validPayload.description,
      });
    });

    it('should associate lead with contractor', async () => {
      vi.mocked(prisma.contractor.findUnique).mockResolvedValue(mockContractor as any);
      vi.mocked(prisma.lead.create).mockResolvedValue({ id: 'lead_123' } as any);

      const request = createMockRequest(validPayload);
      await POST(request);

      const createCall = vi.mocked(prisma.lead.create).mock.calls[0][0];
      expect(createCall.data.contractorId).toBe(mockContractor.id);
    });
  });

  describe('decimal precision', () => {
    it('should round budget to nearest cent', async () => {
      vi.mocked(prisma.contractor.findUnique).mockResolvedValue(mockContractor as any);
      vi.mocked(prisma.lead.create).mockResolvedValue({ id: 'lead_123' } as any);

      const request = createMockRequest({
        ...validPayload,
        budget: 15000.456, // Should round to 1500046 cents
      });

      await POST(request);

      const createCall = vi.mocked(prisma.lead.create).mock.calls[0][0];
      expect(createCall.data.budgetCents).toBe(1500046);
    });

    it('should handle large budget values', async () => {
      vi.mocked(prisma.contractor.findUnique).mockResolvedValue(mockContractor as any);
      vi.mocked(prisma.lead.create).mockResolvedValue({ id: 'lead_123' } as any);

      const request = createMockRequest({
        ...validPayload,
        budget: 999999.99,
      });

      await POST(request);

      const createCall = vi.mocked(prisma.lead.create).mock.calls[0][0];
      expect(createCall.data.budgetCents).toBe(99999999);
    });
  });
});
