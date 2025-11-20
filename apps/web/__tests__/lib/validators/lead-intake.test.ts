import { describe, it, expect } from 'vitest';
import { leadIntakeSchema } from '@/lib/validators/lead-intake';

describe('Lead Intake Validator', () => {
  describe('leadIntakeSchema', () => {
    const validData = {
      homeownerName: 'John Doe',
      homeownerEmail: 'john@example.com',
      homeownerPhone: '555-1234',
      address: '123 Main St, City, ST 12345',
      projectType: 'ROOFING',
      budget: 15000,
      timeline: '2024-06-01',
      description: 'Need roof replacement due to storm damage with detailed requirements',
    };

    it('should validate complete and correct data', () => {
      const result = leadIntakeSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    describe('homeownerName validation', () => {
      it('should reject names shorter than 2 characters', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          homeownerName: 'J',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('Please share your name');
        }
      });

      it('should accept names with 2 or more characters', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          homeownerName: 'Jo',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('homeownerEmail validation', () => {
      it('should reject invalid email formats', () => {
        const invalidEmails = ['notanemail', '@example.com', 'user@', 'user @example.com'];

        invalidEmails.forEach((email) => {
          const result = leadIntakeSchema.safeParse({
            ...validData,
            homeownerEmail: email,
          });
          expect(result.success).toBe(false);
        });
      });

      it('should accept valid email formats', () => {
        const validEmails = [
          'user@example.com',
          'user.name@example.com',
          'user+tag@example.co.uk',
        ];

        validEmails.forEach((email) => {
          const result = leadIntakeSchema.safeParse({
            ...validData,
            homeownerEmail: email,
          });
          expect(result.success).toBe(true);
        });
      });
    });

    describe('homeownerPhone validation', () => {
      it('should reject phone numbers shorter than 7 characters', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          homeownerPhone: '123456',
        });
        expect(result.success).toBe(false);
      });

      it('should reject phone numbers longer than 20 characters', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          homeownerPhone: '123456789012345678901',
        });
        expect(result.success).toBe(false);
      });

      it('should accept valid phone number formats', () => {
        const validPhones = ['555-1234', '(555) 123-4567', '+1-555-123-4567', '5551234567'];

        validPhones.forEach((phone) => {
          const result = leadIntakeSchema.safeParse({
            ...validData,
            homeownerPhone: phone,
          });
          expect(result.success).toBe(true);
        });
      });
    });

    describe('address validation', () => {
      it('should reject addresses shorter than 5 characters', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          address: '123',
        });
        expect(result.success).toBe(false);
      });

      it('should accept addresses with 5 or more characters', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          address: '123 M',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('projectType validation', () => {
      it('should reject empty project type', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          projectType: '',
        });
        expect(result.success).toBe(false);
      });

      it('should accept any non-empty string', () => {
        const projectTypes = ['ROOFING', 'PAINTING', 'PLUMBING', 'CUSTOM'];

        projectTypes.forEach((type) => {
          const result = leadIntakeSchema.safeParse({
            ...validData,
            projectType: type,
          });
          expect(result.success).toBe(true);
        });
      });
    });

    describe('budget validation and parsing', () => {
      it('should accept numeric budget values', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          budget: 25000,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.budget).toBe(25000);
        }
      });

      it('should parse budget strings with dollar signs', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          budget: '$15,000',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.budget).toBe(15000);
        }
      });

      it('should parse budget strings with commas', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          budget: '25,000',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.budget).toBe(25000);
        }
      });

      it('should parse budget strings with decimals', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          budget: '15000.50',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.budget).toBe(15000.5);
        }
      });

      it('should parse complex budget format ($xx,xxx.xx)', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          budget: '$25,000.75',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.budget).toBe(25000.75);
        }
      });

      it('should accept zero as budget', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          budget: 0,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.budget).toBe(0);
        }
      });

      it('should reject negative budgets', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          budget: -1000,
        });
        expect(result.success).toBe(false);
      });

      it('should reject empty string budget', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          budget: '   ',
        });
        // Empty string gets parsed as NaN -> undefined -> fails positive validation
        expect(result.success).toBe(false);
      });

      it('should allow budget to be optional (undefined)', () => {
        const { budget, ...dataWithoutBudget } = validData;
        const result = leadIntakeSchema.safeParse(dataWithoutBudget);
        expect(result.success).toBe(true);
      });

      it('should handle non-numeric strings as optional', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          budget: 'not-a-number',
        });
        // Non-numeric string becomes NaN -> 0, which is valid
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.budget).toBe(0);
        }
      });
    });

    describe('timeline validation', () => {
      it('should accept valid ISO date strings', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          timeline: '2024-12-31',
        });
        expect(result.success).toBe(true);
      });

      it('should accept date strings in various formats', () => {
        const validDates = ['2024-06-01', '01/15/2024', 'June 1, 2024'];

        validDates.forEach((date) => {
          const result = leadIntakeSchema.safeParse({
            ...validData,
            timeline: date,
          });
          expect(result.success).toBe(true);
        });
      });

      it('should reject invalid date strings', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          timeline: 'not-a-date',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('invalid');
        }
      });

      it('should allow timeline to be optional', () => {
        const { timeline, ...dataWithoutTimeline } = validData;
        const result = leadIntakeSchema.safeParse(dataWithoutTimeline);
        expect(result.success).toBe(true);
      });

      it('should allow empty string timeline', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          timeline: '',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('description validation', () => {
      it('should reject descriptions shorter than 10 characters', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          description: 'Too short',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('short description');
        }
      });

      it('should accept descriptions with 10 or more characters', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          description: '0123456789',
        });
        expect(result.success).toBe(true);
      });

      it('should reject descriptions longer than 2000 characters', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          description: 'a'.repeat(2001),
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain('under 2000 characters');
        }
      });

      it('should accept descriptions exactly 2000 characters', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          description: 'a'.repeat(2000),
        });
        expect(result.success).toBe(true);
      });
    });

    describe('photos validation', () => {
      it('should accept valid photo metadata array', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          photos: [
            {
              key: 'photos/test1.jpg',
              url: 'https://example.com/photo1.jpg',
              name: 'photo1.jpg',
              type: 'image/jpeg',
              size: 1024000,
            },
          ],
        });
        expect(result.success).toBe(true);
      });

      it('should reject more than 10 photos', () => {
        const photos = Array(11)
          .fill(null)
          .map((_, i) => ({
            key: `photos/test${i}.jpg`,
            url: `https://example.com/photo${i}.jpg`,
            name: `photo${i}.jpg`,
            type: 'image/jpeg',
            size: 1024000,
          }));

        const result = leadIntakeSchema.safeParse({
          ...validData,
          photos,
        });
        expect(result.success).toBe(false);
      });

      it('should accept exactly 10 photos', () => {
        const photos = Array(10)
          .fill(null)
          .map((_, i) => ({
            key: `photos/test${i}.jpg`,
            url: `https://example.com/photo${i}.jpg`,
            name: `photo${i}.jpg`,
            type: 'image/jpeg',
            size: 1024000,
          }));

        const result = leadIntakeSchema.safeParse({
          ...validData,
          photos,
        });
        expect(result.success).toBe(true);
      });

      it('should allow photos to be optional', () => {
        const result = leadIntakeSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it('should accept empty photos array', () => {
        const result = leadIntakeSchema.safeParse({
          ...validData,
          photos: [],
        });
        expect(result.success).toBe(true);
      });

      describe('photo metadata validation', () => {
        it('should require photo key', () => {
          const result = leadIntakeSchema.safeParse({
            ...validData,
            photos: [
              {
                url: 'https://example.com/photo.jpg',
                name: 'photo.jpg',
                type: 'image/jpeg',
                size: 1024000,
              },
            ],
          });
          expect(result.success).toBe(false);
        });

        it('should require valid URL', () => {
          const result = leadIntakeSchema.safeParse({
            ...validData,
            photos: [
              {
                key: 'photos/test.jpg',
                url: 'not-a-url',
                name: 'photo.jpg',
                type: 'image/jpeg',
                size: 1024000,
              },
            ],
          });
          expect(result.success).toBe(false);
        });

        it('should require photo name', () => {
          const result = leadIntakeSchema.safeParse({
            ...validData,
            photos: [
              {
                key: 'photos/test.jpg',
                url: 'https://example.com/photo.jpg',
                name: '',
                type: 'image/jpeg',
                size: 1024000,
              },
            ],
          });
          expect(result.success).toBe(false);
        });

        it('should require photo type', () => {
          const result = leadIntakeSchema.safeParse({
            ...validData,
            photos: [
              {
                key: 'photos/test.jpg',
                url: 'https://example.com/photo.jpg',
                name: 'photo.jpg',
                type: '',
                size: 1024000,
              },
            ],
          });
          expect(result.success).toBe(false);
        });

        it('should require non-negative size', () => {
          const result = leadIntakeSchema.safeParse({
            ...validData,
            photos: [
              {
                key: 'photos/test.jpg',
                url: 'https://example.com/photo.jpg',
                name: 'photo.jpg',
                type: 'image/jpeg',
                size: -1,
              },
            ],
          });
          expect(result.success).toBe(false);
        });

        it('should accept zero size', () => {
          const result = leadIntakeSchema.safeParse({
            ...validData,
            photos: [
              {
                key: 'photos/test.jpg',
                url: 'https://example.com/photo.jpg',
                name: 'photo.jpg',
                type: 'image/jpeg',
                size: 0,
              },
            ],
          });
          expect(result.success).toBe(true);
        });

        it('should allow optional id field in photo metadata', () => {
          const result = leadIntakeSchema.safeParse({
            ...validData,
            photos: [
              {
                id: 'photo_123',
                key: 'photos/test.jpg',
                url: 'https://example.com/photo.jpg',
                name: 'photo.jpg',
                type: 'image/jpeg',
                size: 1024000,
              },
            ],
          });
          expect(result.success).toBe(true);
        });
      });
    });

    describe('complete validation scenarios', () => {
      it('should accept minimal valid data (no optional fields)', () => {
        const minimalData = {
          homeownerName: 'John Doe',
          homeownerEmail: 'john@example.com',
          homeownerPhone: '555-1234',
          address: '123 Main St',
          projectType: 'ROOFING',
          description: 'Need roof replacement',
        };

        const result = leadIntakeSchema.safeParse(minimalData);
        expect(result.success).toBe(true);
      });

      it('should return all validation errors for invalid data', () => {
        const invalidData = {
          homeownerName: 'J',
          homeownerEmail: 'invalid-email',
          homeownerPhone: '123',
          address: '123',
          projectType: '',
          description: 'short',
        };

        const result = leadIntakeSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThan(1);
        }
      });
    });
  });
});
