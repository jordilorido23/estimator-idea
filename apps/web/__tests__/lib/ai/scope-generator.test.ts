import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateScopeOfWork } from '@/lib/ai/scope-generator';
import type { PhotoAnalysis } from '@/lib/ai/photo-analyzer';

// Create a mock messages.create function
const mockCreate = vi.fn();

vi.mock('@/lib/ai', () => ({
  getAnthropicClient: vi.fn(() => ({
    messages: {
      create: mockCreate,
    },
  })),
  AI_MODELS: {
    SONNET: 'claude-3-5-sonnet-20241022',
    HAIKU: 'claude-3-5-haiku-20241022',
  },
}));

describe('Scope Generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockPhotoAnalysis: PhotoAnalysis = {
    tradeType: ['roofing'],
    conditions: ['damaged', 'aged'],
    materials: ['asphalt shingles'],
    accessConstraints: ['second story'],
    workItems: ['remove old shingles', 'install new roofing'],
    confidence: 0.85,
    notes: 'Roof requires full replacement',
  };

  describe('generateScopeOfWork', () => {
    it('should generate comprehensive scope of work', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              summary: 'Complete roof replacement for 2-story residential property',
              lineItems: [
                {
                  category: 'Demolition',
                  description: 'Remove existing asphalt shingles and dispose',
                  notes: 'Include dumpster rental',
                },
                {
                  category: 'Installation',
                  description: 'Install new architectural shingles',
                },
                {
                  category: 'Finishing',
                  description: 'Install ridge cap and flashing',
                },
              ],
              potentialIssues: [
                'Roof decking may need replacement if damaged',
                'Access requires scaffolding for second story',
              ],
              missingInformation: [
                'Exact roof square footage',
                'Preferred shingle color/brand',
              ],
              recommendations: [
                'Conduct attic inspection for ventilation',
                'Consider ice and water shield in valleys',
              ],
            }),
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const result = await generateScopeOfWork({
        leadData: {
          homeownerName: 'John Doe',
          address: '123 Main St',
          tradeType: 'ROOFING',
          budget: 15000,
          timeline: 'Within 2 months',
          notes: 'Roof is leaking',
        },
        photoAnalyses: [mockPhotoAnalysis],
      });

      expect(result).toBeDefined();
      expect(result.summary).toContain('roof replacement');
      expect(result.lineItems).toHaveLength(3);
      expect(result.lineItems[0].category).toBe('Demolition');
      expect(result.potentialIssues).toHaveLength(2);
      expect(result.missingInformation).toHaveLength(2);
      expect(result.recommendations).toHaveLength(2);
    });

    it('should handle minimal lead data', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              summary: 'Basic roofing project',
              lineItems: [
                {
                  category: 'Installation',
                  description: 'Install new roof',
                },
              ],
              potentialIssues: [],
              missingInformation: ['Budget', 'Timeline', 'Detailed requirements'],
              recommendations: ['Schedule site visit for detailed assessment'],
            }),
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const result = await generateScopeOfWork({
        leadData: {
          homeownerName: 'Jane Smith',
          address: '456 Oak Ave',
          tradeType: 'ROOFING',
        },
        photoAnalyses: [mockPhotoAnalysis],
      });

      expect(result.summary).toBeDefined();
      expect(result.missingInformation).toContain('Budget');
      expect(result.missingInformation).toContain('Timeline');
    });

    it('should throw error if response is invalid JSON', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: 'Not valid JSON',
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      await expect(
        generateScopeOfWork({
          leadData: {
            homeownerName: 'Test',
            address: 'Test',
            tradeType: 'ROOFING',
          },
          photoAnalyses: [mockPhotoAnalysis],
        })
      ).rejects.toThrow('No JSON found in Claude response');
    });

    it('should throw error if required fields are missing', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              // Missing summary and lineItems
              potentialIssues: [],
              missingInformation: [],
              recommendations: [],
            }),
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      await expect(
        generateScopeOfWork({
          leadData: {
            homeownerName: 'Test',
            address: 'Test',
            tradeType: 'ROOFING',
          },
          photoAnalyses: [mockPhotoAnalysis],
        })
      ).rejects.toThrow('Invalid scope structure from Claude');
    });

    it('should handle multiple photo analyses', async () => {
      const { getAnthropicClient } = await import('@/lib/ai');
      const mockClient = getAnthropicClient();

      const mockAnalysis2: PhotoAnalysis = {
        tradeType: ['siding'],
        conditions: ['weathered'],
        materials: ['vinyl siding'],
        accessConstraints: [],
        workItems: ['replace siding'],
        confidence: 0.75,
        notes: 'Siding needs replacement',
      };

      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              summary: 'Complete exterior renovation including roof and siding',
              lineItems: [
                { category: 'Roofing', description: 'Replace roof' },
                { category: 'Siding', description: 'Replace siding' },
              ],
              potentialIssues: ['Multiple trades coordination required'],
              missingInformation: [],
              recommendations: ['Consider scheduling both projects together'],
            }),
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const result = await generateScopeOfWork({
        leadData: {
          homeownerName: 'Test',
          address: 'Test',
          tradeType: 'OTHER',
          budget: 30000,
        },
        photoAnalyses: [mockPhotoAnalysis, mockAnalysis2],
      });

      expect(result.lineItems).toHaveLength(2);
      expect(result.summary).toContain('roof and siding');
    });
  });
});
