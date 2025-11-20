import { describe, it, expect } from 'vitest';
import { estimateFeedbackSchema } from '@/lib/validators/estimate-feedback';

describe('Estimate Feedback Validator', () => {
  describe('estimateFeedbackSchema', () => {
    const validData = {
      projectOutcome: 'WON' as const,
      actualCost: 15000,
      completedAt: '2024-02-15T10:00:00.000Z',
      feedbackNotes: 'Project completed successfully',
    };

    it('should validate complete and correct data', () => {
      const result = estimateFeedbackSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    describe('projectOutcome validation', () => {
      it('should accept WON outcome', () => {
        const result = estimateFeedbackSchema.safeParse({
          ...validData,
          projectOutcome: 'WON',
        });
        expect(result.success).toBe(true);
      });

      it('should accept LOST outcome', () => {
        const result = estimateFeedbackSchema.safeParse({
          ...validData,
          projectOutcome: 'LOST',
        });
        expect(result.success).toBe(true);
      });

      it('should accept IN_PROGRESS outcome', () => {
        const result = estimateFeedbackSchema.safeParse({
          ...validData,
          projectOutcome: 'IN_PROGRESS',
        });
        expect(result.success).toBe(true);
      });

      it('should accept CANCELLED outcome', () => {
        const result = estimateFeedbackSchema.safeParse({
          ...validData,
          projectOutcome: 'CANCELLED',
        });
        expect(result.success).toBe(true);
      });

      it('should reject invalid outcome values', () => {
        const result = estimateFeedbackSchema.safeParse({
          ...validData,
          projectOutcome: 'INVALID_STATUS',
        });
        expect(result.success).toBe(false);
      });

      it('should reject empty string outcome', () => {
        const result = estimateFeedbackSchema.safeParse({
          ...validData,
          projectOutcome: '',
        });
        expect(result.success).toBe(false);
      });

      it('should require projectOutcome field', () => {
        const { projectOutcome, ...dataWithoutOutcome } = validData;
        const result = estimateFeedbackSchema.safeParse(dataWithoutOutcome);
        expect(result.success).toBe(false);
      });
    });

    describe('actualCost validation', () => {
      it('should accept positive numbers', () => {
        const result = estimateFeedbackSchema.safeParse({
          ...validData,
          actualCost: 25000,
        });
        expect(result.success).toBe(true);
      });

      it('should accept decimal values', () => {
        const result = estimateFeedbackSchema.safeParse({
          ...validData,
          actualCost: 15000.50,
        });
        expect(result.success).toBe(true);
      });

      it('should reject zero', () => {
        const result = estimateFeedbackSchema.safeParse({
          ...validData,
          actualCost: 0,
        });
        expect(result.success).toBe(false);
      });

      it('should reject negative numbers', () => {
        const result = estimateFeedbackSchema.safeParse({
          ...validData,
          actualCost: -1000,
        });
        expect(result.success).toBe(false);
      });

      it('should allow actualCost to be optional', () => {
        const { actualCost, ...dataWithoutCost } = validData;
        const result = estimateFeedbackSchema.safeParse(dataWithoutCost);
        expect(result.success).toBe(true);
      });

      it('should allow undefined actualCost', () => {
        const result = estimateFeedbackSchema.safeParse({
          ...validData,
          actualCost: undefined,
        });
        expect(result.success).toBe(true);
      });

      it('should accept very large numbers', () => {
        const result = estimateFeedbackSchema.safeParse({
          ...validData,
          actualCost: 1000000,
        });
        expect(result.success).toBe(true);
      });

      it('should accept small positive numbers', () => {
        const result = estimateFeedbackSchema.safeParse({
          ...validData,
          actualCost: 0.01,
        });
        expect(result.success).toBe(true);
      });
    });

    describe('completedAt validation', () => {
      it('should accept valid ISO datetime strings', () => {
        const validDates = [
          '2024-02-15T10:00:00.000Z',
          '2024-01-01T00:00:00Z',
          '2024-12-31T23:59:59.999Z',
        ];

        validDates.forEach((date) => {
          const result = estimateFeedbackSchema.safeParse({
            ...validData,
            completedAt: date,
          });
          expect(result.success).toBe(true);
        });
      });

      it('should reject invalid datetime formats', () => {
        const invalidDates = [
          '2024-02-15', // Date only, no time
          '02/15/2024', // Wrong format
          'February 15, 2024', // Wrong format
          'not-a-date',
        ];

        invalidDates.forEach((date) => {
          const result = estimateFeedbackSchema.safeParse({
            ...validData,
            completedAt: date,
          });
          expect(result.success).toBe(false);
        });
      });

      it('should allow completedAt to be optional', () => {
        const { completedAt, ...dataWithoutDate } = validData;
        const result = estimateFeedbackSchema.safeParse(dataWithoutDate);
        expect(result.success).toBe(true);
      });

      it('should allow undefined completedAt', () => {
        const result = estimateFeedbackSchema.safeParse({
          ...validData,
          completedAt: undefined,
        });
        expect(result.success).toBe(true);
      });

      it('should accept datetime with Z timezone', () => {
        const result = estimateFeedbackSchema.safeParse({
          ...validData,
          completedAt: '2024-02-15T10:00:00Z',
        });
        expect(result.success).toBe(true);
      });

      it('should accept datetime with milliseconds', () => {
        const result = estimateFeedbackSchema.safeParse({
          ...validData,
          completedAt: '2024-02-15T10:00:00.123Z',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('feedbackNotes validation', () => {
      it('should accept any string', () => {
        const result = estimateFeedbackSchema.safeParse({
          ...validData,
          feedbackNotes: 'Any notes here',
        });
        expect(result.success).toBe(true);
      });

      it('should accept empty string', () => {
        const result = estimateFeedbackSchema.safeParse({
          ...validData,
          feedbackNotes: '',
        });
        expect(result.success).toBe(true);
      });

      it('should accept long strings', () => {
        const result = estimateFeedbackSchema.safeParse({
          ...validData,
          feedbackNotes: 'a'.repeat(5000),
        });
        expect(result.success).toBe(true);
      });

      it('should allow feedbackNotes to be optional', () => {
        const { feedbackNotes, ...dataWithoutNotes } = validData;
        const result = estimateFeedbackSchema.safeParse(dataWithoutNotes);
        expect(result.success).toBe(true);
      });

      it('should allow undefined feedbackNotes', () => {
        const result = estimateFeedbackSchema.safeParse({
          ...validData,
          feedbackNotes: undefined,
        });
        expect(result.success).toBe(true);
      });

      it('should accept special characters and newlines', () => {
        const result = estimateFeedbackSchema.safeParse({
          ...validData,
          feedbackNotes: 'Line 1\nLine 2\nSpecial: !@#$%^&*()',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('complete validation scenarios', () => {
      it('should accept minimal valid data (only projectOutcome)', () => {
        const minimalData = {
          projectOutcome: 'LOST' as const,
        };

        const result = estimateFeedbackSchema.safeParse(minimalData);
        expect(result.success).toBe(true);
      });

      it('should accept WON project with all fields', () => {
        const wonData = {
          projectOutcome: 'WON' as const,
          actualCost: 15800,
          completedAt: '2024-02-15T10:00:00.000Z',
          feedbackNotes: 'Project completed under budget',
        };

        const result = estimateFeedbackSchema.safeParse(wonData);
        expect(result.success).toBe(true);
      });

      it('should accept LOST project without actualCost', () => {
        const lostData = {
          projectOutcome: 'LOST' as const,
          feedbackNotes: 'Lost to competitor',
        };

        const result = estimateFeedbackSchema.safeParse(lostData);
        expect(result.success).toBe(true);
      });

      it('should accept CANCELLED project', () => {
        const cancelledData = {
          projectOutcome: 'CANCELLED' as const,
          feedbackNotes: 'Homeowner decided not to proceed',
        };

        const result = estimateFeedbackSchema.safeParse(cancelledData);
        expect(result.success).toBe(true);
      });

      it('should accept IN_PROGRESS with partial data', () => {
        const inProgressData = {
          projectOutcome: 'IN_PROGRESS' as const,
          feedbackNotes: 'Work started',
        };

        const result = estimateFeedbackSchema.safeParse(inProgressData);
        expect(result.success).toBe(true);
      });
    });

    describe('type inference', () => {
      it('should infer correct TypeScript types from parsed data', () => {
        const result = estimateFeedbackSchema.safeParse(validData);

        if (result.success) {
          // TypeScript should infer these types correctly
          const outcome: 'WON' | 'LOST' | 'IN_PROGRESS' | 'CANCELLED' = result.data.projectOutcome;
          const cost: number | undefined = result.data.actualCost;
          const completed: string | undefined = result.data.completedAt;
          const notes: string | undefined = result.data.feedbackNotes;

          expect(outcome).toBe('WON');
          expect(cost).toBe(15000);
          expect(completed).toBe('2024-02-15T10:00:00.000Z');
          expect(notes).toBe('Project completed successfully');
        }
      });
    });
  });
});
