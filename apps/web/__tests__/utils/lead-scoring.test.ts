import { describe, it, expect } from 'vitest';

// Helper function to calculate lead score (extracted from API route logic)
function calculateLeadScore(
  summary: { overallConfidence: number; totalWorkItems: number; hasSafetyHazards: boolean },
  leadData: { budget?: number; timeline?: string; notes?: string }
): number {
  let score = 0;

  // Photo analysis confidence (0-40 points)
  score += summary.overallConfidence * 40;

  // Completeness of work items (0-20 points)
  score += Math.min(summary.totalWorkItems / 5, 1) * 20;

  // Budget provided (10 points)
  if (leadData.budget) score += 10;

  // Timeline provided (10 points)
  if (leadData.timeline) score += 10;

  // Description provided (10 points)
  if (leadData.notes && leadData.notes.length > 20) score += 10;

  // Safety hazards decrease score (up to -10 points)
  if (summary.hasSafetyHazards) score -= 10;

  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}

describe('Lead Scoring', () => {
  describe('calculateLeadScore', () => {
    it('should calculate perfect score for complete, high-quality lead', () => {
      const score = calculateLeadScore(
        {
          overallConfidence: 1.0,
          totalWorkItems: 5,
          hasSafetyHazards: false,
        },
        {
          budget: 10000,
          timeline: 'Within 2 months',
          notes: 'This is a detailed description of the project with more than 20 characters',
        }
      );

      // 40 (confidence) + 20 (work items) + 10 (budget) + 10 (timeline) + 10 (notes) = 90
      expect(score).toBe(90);
    });

    it('should calculate score for minimal lead data', () => {
      const score = calculateLeadScore(
        {
          overallConfidence: 0.5,
          totalWorkItems: 2,
          hasSafetyHazards: false,
        },
        {
          // No additional data
        }
      );

      // 20 (confidence) + 8 (work items) = 28
      expect(score).toBe(28);
    });

    it('should penalize safety hazards', () => {
      const score = calculateLeadScore(
        {
          overallConfidence: 0.8,
          totalWorkItems: 4,
          hasSafetyHazards: true,
        },
        {
          budget: 10000,
          timeline: 'ASAP',
          notes: 'Project needs immediate attention',
        }
      );

      // 32 (confidence) + 16 (work items) + 10 (budget) + 10 (timeline) + 10 (notes) - 10 (hazards) = 68
      expect(score).toBe(68);
    });

    it('should cap work items contribution at 20 points', () => {
      const score1 = calculateLeadScore(
        {
          overallConfidence: 0,
          totalWorkItems: 5,
          hasSafetyHazards: false,
        },
        {}
      );

      const score2 = calculateLeadScore(
        {
          overallConfidence: 0,
          totalWorkItems: 10,
          hasSafetyHazards: false,
        },
        {}
      );

      // Both should have 20 points from work items (5+ items = max 20 points)
      expect(score1).toBe(20);
      expect(score2).toBe(20);
    });

    it('should not give points for short notes', () => {
      const score = calculateLeadScore(
        {
          overallConfidence: 0,
          totalWorkItems: 0,
          hasSafetyHazards: false,
        },
        {
          notes: 'Short note',
        }
      );

      // No points for notes under 20 characters
      expect(score).toBe(0);
    });

    it('should clamp minimum score to 0', () => {
      const score = calculateLeadScore(
        {
          overallConfidence: 0,
          totalWorkItems: 0,
          hasSafetyHazards: true, // -10 points
        },
        {}
      );

      // Would be -10, but clamped to 0
      expect(score).toBe(0);
    });

    it('should clamp maximum score to 100', () => {
      // This shouldn't happen in practice, but test the clamp
      const score = calculateLeadScore(
        {
          overallConfidence: 1.5, // Hypothetically > 1.0
          totalWorkItems: 10,
          hasSafetyHazards: false,
        },
        {
          budget: 50000,
          timeline: 'Flexible',
          notes: 'Very detailed project description with all requirements',
        }
      );

      // Would be > 100, but clamped to 100
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should handle edge case of exactly 5 work items', () => {
      const score = calculateLeadScore(
        {
          overallConfidence: 0,
          totalWorkItems: 5,
          hasSafetyHazards: false,
        },
        {}
      );

      // 5 work items = exactly 20 points
      expect(score).toBe(20);
    });

    it('should handle fractional confidence values', () => {
      const score = calculateLeadScore(
        {
          overallConfidence: 0.73,
          totalWorkItems: 3,
          hasSafetyHazards: false,
        },
        {
          budget: 5000,
        }
      );

      // 29.2 (confidence) + 12 (work items) + 10 (budget) = 51.2, rounded to 51
      expect(score).toBe(51);
    });

    it('should weight confidence heavily in score', () => {
      const lowConfidence = calculateLeadScore(
        {
          overallConfidence: 0.2,
          totalWorkItems: 5,
          hasSafetyHazards: false,
        },
        {
          budget: 10000,
          timeline: 'Soon',
          notes: 'Detailed project requirements',
        }
      );

      const highConfidence = calculateLeadScore(
        {
          overallConfidence: 0.9,
          totalWorkItems: 5,
          hasSafetyHazards: false,
        },
        {
          budget: 10000,
          timeline: 'Soon',
          notes: 'Detailed project requirements',
        }
      );

      // High confidence should score significantly higher
      expect(highConfidence - lowConfidence).toBeGreaterThan(20);
    });
  });
});
