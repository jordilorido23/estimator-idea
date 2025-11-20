import { z } from 'zod';

const photoMetadataSchema = z.object({
  id: z.string().optional(),
  key: z.string({ required_error: 'Photo key is required' }),
  url: z.string().url('Photo URL must be valid'),
  name: z.string().min(1, 'Photo name is required'),
  type: z.string().min(1, 'Photo content-type is required'),
  size: z.number().nonnegative()
});

const documentMetadataSchema = z.object({
  id: z.string().optional(),
  key: z.string({ required_error: 'Document key is required' }),
  url: z.string().url('Document URL must be valid'),
  name: z.string().min(1, 'Document name is required'),
  type: z.string().min(1, 'Document content-type is required'),
  size: z.number().nonnegative()
});

const budgetSchema = z
  .preprocess((value) => {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const parsed = Number(trimmed.replace(/[^0-9.]/g, ''));
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }, z.number().nonnegative('Budget must be zero or greater'))
  .optional();

export const leadIntakeSchema = z.object({
  homeownerName: z.string().min(2, 'Please share your name'),
  homeownerEmail: z.string().email('A valid email helps us follow up'),
  homeownerPhone: z
    .string()
    .min(7, 'Phone number is required')
    .max(20, 'Phone number is too long'),
  address: z.string().min(5, 'Project address is required'),
  projectType: z.string().min(1, 'Choose the project type'),
  budget: budgetSchema,
  timeline: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), 'Timeline date is invalid'),
  description: z
    .string()
    .min(10, 'A short description helps the contractor plan ahead')
    .max(2000, 'Please keep the description under 2000 characters'),
  photos: z.array(photoMetadataSchema).max(10, 'Please upload up to 10 photos').optional(),
  documents: z.array(documentMetadataSchema).max(10, 'Please upload up to 10 documents').optional()
});

export type LeadIntakeValues = z.infer<typeof leadIntakeSchema>;
export type LeadPhotoMetadata = z.infer<typeof photoMetadataSchema>;
export type LeadDocumentMetadata = z.infer<typeof documentMetadataSchema>;
