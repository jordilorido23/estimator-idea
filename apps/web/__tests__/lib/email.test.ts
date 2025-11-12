import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendNewLeadNotification, sendHomeownerConfirmation } from '@/lib/email';

// Create a mock send function
const mockSend = vi.fn();

// Mock Resend with proper constructor
vi.mock('resend', () => {
  return {
    Resend: vi.fn(function (this: any) {
      this.emails = {
        send: mockSend,
      };
      return this;
    }),
  };
});

// Mock env
vi.mock('@/src/env', () => ({
  env: {
    RESEND_API_KEY: 'test-key',
  },
}));

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendNewLeadNotification', () => {
    it('should send email notification to contractor', async () => {
      mockSend.mockResolvedValue({ id: 'test-id' } as any);

      const result = await sendNewLeadNotification({
        contractorName: 'Test Contractor',
        contractorEmail: 'contractor@example.com',
        leadId: 'lead-123',
        homeownerName: 'John Doe',
        homeownerEmail: 'john@example.com',
        homeownerPhone: '555-1234',
        address: '123 Main St',
        tradeType: 'ROOFING',
        budget: 15000,
        timeline: 'Within 2 months',
        description: 'Need roof replacement',
        photoCount: 3,
        dashboardUrl: 'http://localhost:3000/dashboard/leads/lead-123',
      });

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'contractor@example.com',
          subject: expect.stringContaining('John Doe'),
          html: expect.stringContaining('New Lead Received'),
        })
      );
    });

    it('should include budget in email if provided', async () => {
      mockSend.mockResolvedValue({ id: 'test-id' } as any);

      await sendNewLeadNotification({
        contractorName: 'Test',
        contractorEmail: 'test@example.com',
        leadId: 'lead-123',
        homeownerName: 'John',
        homeownerEmail: 'john@example.com',
        homeownerPhone: '555-1234',
        address: '123 Main St',
        tradeType: 'ROOFING',
        budget: 25000,
        photoCount: 2,
        dashboardUrl: 'http://localhost:3000/dashboard/leads/lead-123',
      });

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.html).toContain('$25,000');
    });

    it('should exclude budget section if not provided', async () => {
      mockSend.mockResolvedValue({ id: 'test-id' } as any);

      await sendNewLeadNotification({
        contractorName: 'Test',
        contractorEmail: 'test@example.com',
        leadId: 'lead-123',
        homeownerName: 'John',
        homeownerEmail: 'john@example.com',
        homeownerPhone: '555-1234',
        address: '123 Main St',
        tradeType: 'ROOFING',
        photoCount: 0,
        dashboardUrl: 'http://localhost:3000/dashboard/leads/lead-123',
      });

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.html).not.toContain('Budget:');
    });

    it('should show AI analysis message if photos provided', async () => {
      mockSend.mockResolvedValue({ id: 'test-id' } as any);

      await sendNewLeadNotification({
        contractorName: 'Test',
        contractorEmail: 'test@example.com',
        leadId: 'lead-123',
        homeownerName: 'John',
        homeownerEmail: 'john@example.com',
        homeownerPhone: '555-1234',
        address: '123 Main St',
        tradeType: 'ROOFING',
        photoCount: 5,
        dashboardUrl: 'http://localhost:3000/dashboard/leads/lead-123',
      });

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.html).toContain('AI Analysis In Progress');
    });

    it('should handle email sending failure', async () => {
      mockSend.mockRejectedValue(new Error('Send failed'));

      const result = await sendNewLeadNotification({
        contractorName: 'Test',
        contractorEmail: 'test@example.com',
        leadId: 'lead-123',
        homeownerName: 'John',
        homeownerEmail: 'john@example.com',
        homeownerPhone: '555-1234',
        address: '123 Main St',
        tradeType: 'ROOFING',
        photoCount: 0,
        dashboardUrl: 'http://localhost:3000/dashboard/leads/lead-123',
      });

      expect(result).toBe(false);
    });
  });

  describe('sendHomeownerConfirmation', () => {
    it('should send confirmation email to homeowner', async () => {
      mockSend.mockResolvedValue({ id: 'test-id' } as any);

      const result = await sendHomeownerConfirmation({
        homeownerName: 'Jane Smith',
        homeownerEmail: 'jane@example.com',
        contractorName: 'ABC Contractors',
        tradeType: 'PAINTING',
      });

      expect(result).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'jane@example.com',
          subject: expect.stringContaining('project inquiry'),
          html: expect.stringContaining('Thank You'),
        })
      );
    });

    it('should include contractor and trade type in message', async () => {
      mockSend.mockResolvedValue({ id: 'test-id' } as any);

      await sendHomeownerConfirmation({
        homeownerName: 'John',
        homeownerEmail: 'john@example.com',
        contractorName: 'XYZ Roofing',
        tradeType: 'ROOFING',
      });

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.html).toContain('XYZ Roofing');
      expect(callArgs.html).toContain('ROOFING');
    });

    it('should handle email sending failure', async () => {
      mockSend.mockRejectedValue(new Error('Send failed'));

      const result = await sendHomeownerConfirmation({
        homeownerName: 'John',
        homeownerEmail: 'john@example.com',
        contractorName: 'Test Contractor',
        tradeType: 'ROOFING',
      });

      expect(result).toBe(false);
    });
  });
});
