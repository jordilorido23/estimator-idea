import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateEstimate, recalculateEstimate } from '@/lib/ai/estimate-generator';
import type { ScopeOfWork } from '@/lib/ai/scope-generator';
import type { EstimateLineItem } from '@/lib/ai/estimate-generator';

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

describe('Estimate Generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockScopeOfWork: ScopeOfWork = {
    summary: 'Complete roof replacement',
    lineItems: [
      {
        category: 'Demolition',
        description: 'Remove old shingles',
      },
      {
        category: 'Installation',
        description: 'Install new roof',
      },
    ],
    potentialIssues: [],
    missingInformation: [],
    recommendations: [],
  };

  describe('generateEstimate', () => {
    it('should generate detailed estimate with line items', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              lineItems: [
                {
                  category: 'Labor',
                  description: 'Roof removal labor',
                  quantity: 16,
                  unit: 'hour',
                  unitCost: 75,
                  totalCost: 1200,
                },
                {
                  category: 'Materials',
                  description: 'Asphalt shingles',
                  quantity: 25,
                  unit: 'square',
                  unitCost: 120,
                  totalCost: 3000,
                },
                {
                  category: 'Labor',
                  description: 'Installation labor',
                  quantity: 24,
                  unit: 'hour',
                  unitCost: 75,
                  totalCost: 1800,
                },
              ],
              assumptions: [
                'Roof decking is in good condition',
                'Standard 3-tab shingles',
                'No structural repairs needed',
              ],
              exclusions: [
                'Chimney repairs',
                'Skylight installation',
                'Gutter replacement',
              ],
            }),
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const result = await generateEstimate({
        scopeOfWork: mockScopeOfWork,
        tradeType: 'ROOFING',
        pricingGuidelines: {
          marginPercentage: 20,
          contingencyPercentage: 10,
          laborRatePerHour: 75,
        },
      });

      expect(result).toBeDefined();
      expect(result.lineItems).toHaveLength(3);
      expect(result.subtotal).toBe(6000); // 1200 + 3000 + 1800
      expect(result.marginPercentage).toBe(20);
      expect(result.marginAmount).toBe(1200); // 6000 * 0.20
      expect(result.contingencyPercentage).toBe(10);
      expect(result.contingencyAmount).toBe(600); // 6000 * 0.10
      expect(result.total).toBe(7800); // 6000 + 1200 + 600
      expect(result.assumptions).toHaveLength(3);
      expect(result.exclusions).toHaveLength(3);
    });

    it('should use default pricing guidelines', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              lineItems: [
                {
                  category: 'Labor',
                  description: 'Work',
                  quantity: 10,
                  unit: 'hour',
                  unitCost: 75,
                  totalCost: 750,
                },
              ],
              assumptions: [],
              exclusions: [],
            }),
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const result = await generateEstimate({
        scopeOfWork: mockScopeOfWork,
        tradeType: 'ROOFING',
      });

      // Should use defaults: 20% margin, 10% contingency
      expect(result.marginPercentage).toBe(20);
      expect(result.contingencyPercentage).toBe(10);
      expect(result.subtotal).toBe(750);
      expect(result.marginAmount).toBe(150); // 750 * 0.20
      expect(result.contingencyAmount).toBe(75); // 750 * 0.10
      expect(result.total).toBe(975); // 750 + 150 + 75
    });

    it('should handle custom pricing guidelines', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              lineItems: [
                {
                  category: 'Labor',
                  description: 'Work',
                  quantity: 10,
                  unit: 'hour',
                  unitCost: 100,
                  totalCost: 1000,
                },
              ],
              assumptions: [],
              exclusions: [],
            }),
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const result = await generateEstimate({
        scopeOfWork: mockScopeOfWork,
        tradeType: 'ROOFING',
        pricingGuidelines: {
          marginPercentage: 25,
          contingencyPercentage: 15,
          laborRatePerHour: 100,
        },
      });

      expect(result.marginPercentage).toBe(25);
      expect(result.marginAmount).toBe(250); // 1000 * 0.25
      expect(result.contingencyPercentage).toBe(15);
      expect(result.contingencyAmount).toBe(150); // 1000 * 0.15
      expect(result.total).toBe(1400); // 1000 + 250 + 150
    });

    it('should throw error for invalid response', async () => {
      const mockResponse = {
        content: [
          {
            type: 'text',
            text: 'Invalid JSON',
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      await expect(
        generateEstimate({
          scopeOfWork: mockScopeOfWork,
          tradeType: 'ROOFING',
        })
      ).rejects.toThrow('No JSON found in Claude response');
    });
  });

  describe('recalculateEstimate', () => {
    it('should recalculate totals correctly', () => {
      const lineItems: EstimateLineItem[] = [
        {
          category: 'Labor',
          description: 'Work',
          quantity: 10,
          unit: 'hour',
          unitCost: 75,
          totalCost: 750,
        },
        {
          category: 'Materials',
          description: 'Supplies',
          quantity: 5,
          unit: 'unit',
          unitCost: 100,
          totalCost: 500,
        },
      ];

      const result = recalculateEstimate(lineItems, 20, 10);

      expect(result.subtotal).toBe(1250); // 750 + 500
      expect(result.marginAmount).toBe(250); // 1250 * 0.20
      expect(result.contingencyAmount).toBe(125); // 1250 * 0.10
      expect(result.total).toBe(1625); // 1250 + 250 + 125
    });

    it('should handle empty line items', () => {
      const result = recalculateEstimate([], 20, 10);

      expect(result.subtotal).toBe(0);
      expect(result.marginAmount).toBe(0);
      expect(result.contingencyAmount).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should handle zero margin and contingency', () => {
      const lineItems: EstimateLineItem[] = [
        {
          category: 'Labor',
          description: 'Work',
          quantity: 10,
          unit: 'hour',
          unitCost: 50,
          totalCost: 500,
        },
      ];

      const result = recalculateEstimate(lineItems, 0, 0);

      expect(result.subtotal).toBe(500);
      expect(result.marginAmount).toBe(0);
      expect(result.contingencyAmount).toBe(0);
      expect(result.total).toBe(500);
    });

    it('should handle high margin and contingency', () => {
      const lineItems: EstimateLineItem[] = [
        {
          category: 'Labor',
          description: 'Work',
          quantity: 10,
          unit: 'hour',
          unitCost: 100,
          totalCost: 1000,
        },
      ];

      const result = recalculateEstimate(lineItems, 50, 25);

      expect(result.subtotal).toBe(1000);
      expect(result.marginAmount).toBe(500); // 1000 * 0.50
      expect(result.contingencyAmount).toBe(250); // 1000 * 0.25
      expect(result.total).toBe(1750); // 1000 + 500 + 250
    });
  });
});
