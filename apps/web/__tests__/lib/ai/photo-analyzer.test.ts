import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeConstructionPhoto, analyzeMultiplePhotos } from '@/lib/ai/photo-analyzer';
import type { PhotoAnalysis } from '@/lib/ai/photo-analyzer';

// Create a mock messages.create function
const mockCreate = vi.fn();

// Mock the Anthropic client
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

describe('Photo Analyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyzeConstructionPhoto', () => {
    it('should analyze a photo and return structured data', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              tradeType: ['roofing', 'siding'],
              conditions: ['weathered', 'aged 15-20 years'],
              dimensions: {
                approximate: '2500 sq ft roof area',
                confidence: 'medium',
              },
              materials: ['asphalt shingles', 'vinyl siding'],
              damage: {
                severity: 'moderate',
                description: 'Missing shingles, curling edges',
              },
              accessConstraints: ['second story', 'steep pitch'],
              workItems: [
                'remove old shingles',
                'inspect decking',
                'install new roofing',
              ],
              safetyHazards: ['steep roof'],
              confidence: 0.85,
              notes: 'Requires full roof replacement',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const result = await analyzeConstructionPhoto('https://example.com/photo.jpg');

      expect(result).toBeDefined();
      expect(result.tradeType).toEqual(['roofing', 'siding']);
      expect(result.confidence).toBe(0.85);
      expect(result.workItems).toHaveLength(3);
      expect(result.damage?.severity).toBe('moderate');
    });

    it('should handle missing optional fields', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              tradeType: ['painting'],
              conditions: ['good condition'],
              materials: ['drywall'],
              accessConstraints: [],
              workItems: ['prime walls', 'paint two coats'],
              confidence: 0.9,
              notes: 'Standard interior paint job',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const result = await analyzeConstructionPhoto('https://example.com/photo.jpg');

      expect(result.tradeType).toEqual(['painting']);
      expect(result.damage).toBeUndefined();
      expect(result.dimensions).toBeUndefined();
      expect(result.safetyHazards).toBeUndefined();
    });

    it('should throw error if API response is invalid', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: 'Invalid JSON response',
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      await expect(
        analyzeConstructionPhoto('https://example.com/photo.jpg')
      ).rejects.toThrow('No JSON found in Claude response');
    });

    it('should throw error if required fields are missing', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              // Missing required fields
              materials: ['wood'],
              notes: 'Test',
            }),
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      await expect(
        analyzeConstructionPhoto('https://example.com/photo.jpg')
      ).rejects.toThrow('Invalid analysis structure from Claude');
    });
  });

  describe('analyzeMultiplePhotos', () => {
    it('should analyze multiple photos and aggregate results', async () => {
      const mockResponses = [
        {
          tradeType: ['roofing'],
          conditions: ['damaged'],
          materials: ['asphalt shingles'],
          accessConstraints: ['high'],
          workItems: ['replace roof'],
          safetyHazards: ['steep pitch'],
          confidence: 0.85,
          notes: 'Roof damage',
        },
        {
          tradeType: ['siding'],
          conditions: ['weathered'],
          materials: ['vinyl siding'],
          accessConstraints: [],
          workItems: ['replace siding'],
          confidence: 0.75,
          notes: 'Siding wear',
        },
      ];

      let callCount = 0;
      mockCreate.mockImplementation(async () => ({
        content: [
          {
            type: 'text',
            text: JSON.stringify(mockResponses[callCount++]),
          },
        ],
      })) as any;

      const result = await analyzeMultiplePhotos([
        'https://example.com/photo1.jpg',
        'https://example.com/photo2.jpg',
      ]);

      expect(result.photos).toHaveLength(2);
      expect(result.summary.primaryTrades).toContain('roofing');
      expect(result.summary.primaryTrades).toContain('siding');
      expect(result.summary.overallConfidence).toBe(0.8); // (0.85 + 0.75) / 2
      expect(result.summary.totalWorkItems).toBe(2);
      expect(result.summary.hasSafetyHazards).toBe(true);
    });

    it('should handle empty photo array', async () => {
      const result = await analyzeMultiplePhotos([]);

      expect(result.photos).toHaveLength(0);
      expect(result.summary.primaryTrades).toHaveLength(0);
      expect(result.summary.overallConfidence).toBe(0);
      expect(result.summary.totalWorkItems).toBe(0);
      expect(result.summary.hasSafetyHazards).toBe(false);
    });
  });
});
