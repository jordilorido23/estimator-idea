/**
 * Zod Schemas for AI Output Validation
 *
 * These schemas validate AI-generated responses to ensure they match expected
 * structure before storing in the database or using in the application.
 */

import { z } from 'zod';

/**
 * Schema for validating photo analysis output from Claude Vision
 */
export const PhotoAnalysisSchema = z.object({
  tradeType: z.array(z.string()).min(1, 'At least one trade type is required'),
  conditions: z.array(z.string()),
  dimensions: z
    .object({
      approximate: z.string(),
      confidence: z.enum(['low', 'medium', 'high']),
    })
    .optional(),
  materials: z.array(z.string()),
  damage: z
    .object({
      severity: z.enum(['minor', 'moderate', 'severe']),
      description: z.string().min(1, 'Damage description is required'),
    })
    .optional(),
  accessConstraints: z.array(z.string()),
  workItems: z.array(z.string()).min(1, 'At least one work item is required'),
  safetyHazards: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1, 'Confidence must be between 0 and 1'),
  notes: z.string(),
});

export type PhotoAnalysis = z.infer<typeof PhotoAnalysisSchema>;

/**
 * Schema for validating scope of work output
 */
export const ScopeOfWorkSchema = z.object({
  summary: z.string().min(10, 'Summary must be at least 10 characters'),
  lineItems: z
    .array(
      z.object({
        category: z.string().min(1, 'Category is required'),
        description: z.string().min(1, 'Description is required'),
        notes: z.string().optional(),
      })
    )
    .min(1, 'At least one line item is required'),
  potentialIssues: z.array(z.string()),
  missingInformation: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export type ScopeOfWork = z.infer<typeof ScopeOfWorkSchema>;

/**
 * Schema for validating estimate line items
 */
export const EstimateLineItemSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().min(1, 'Unit is required'),
  unitCost: z.number().nonnegative('Unit cost cannot be negative'),
  totalCost: z.number().nonnegative('Total cost cannot be negative'),
  notes: z.string().optional(),
});

export type EstimateLineItem = z.infer<typeof EstimateLineItemSchema>;

/**
 * Schema for validating complete generated estimate
 */
export const GeneratedEstimateSchema = z.object({
  lineItems: z.array(EstimateLineItemSchema).min(1, 'At least one line item is required'),
  subtotal: z.number().nonnegative('Subtotal cannot be negative'),
  marginPercentage: z.number().min(0).max(100, 'Margin must be 0-100%'),
  marginAmount: z.number().nonnegative('Margin amount cannot be negative'),
  contingencyPercentage: z.number().min(0).max(100, 'Contingency must be 0-100%'),
  contingencyAmount: z.number().nonnegative('Contingency amount cannot be negative'),
  total: z.number().positive('Total must be positive'),
  assumptions: z.array(z.string()),
  exclusions: z.array(z.string()),
});

export type GeneratedEstimate = z.infer<typeof GeneratedEstimateSchema>;

/**
 * Schema for validating photo analysis summary
 */
export const AnalysisSummarySchema = z.object({
  overallConfidence: z.number().min(0).max(1),
  primaryTrades: z.array(z.string()),
  totalWorkItems: z.number().nonnegative(),
  hasSafetyHazards: z.boolean(),
});

export type AnalysisSummary = z.infer<typeof AnalysisSummarySchema>;

/**
 * Schema for validating multiple photo analysis results
 */
export const MultiplePhotoAnalysisResultSchema = z.object({
  photos: z.array(
    z.object({
      url: z.string().url(),
      analysis: PhotoAnalysisSchema,
    })
  ),
  summary: AnalysisSummarySchema,
});

export type MultiplePhotoAnalysisResult = z.infer<typeof MultiplePhotoAnalysisResultSchema>;

/**
 * Schema for validating room dimensions extracted from plans
 */
export const RoomDimensionsSchema = z.object({
  roomName: z.string().min(1, 'Room name is required'),
  length: z.number().positive('Length must be positive').optional(),
  width: z.number().positive('Width must be positive').optional(),
  height: z.number().positive('Height must be positive').optional(),
  area: z.number().nonnegative('Area cannot be negative').optional(),
  unit: z.enum(['feet', 'inches', 'meters', 'centimeters']).default('feet'),
  confidence: z.enum(['low', 'medium', 'high']),
  notes: z.string().optional(),
});

export type RoomDimensions = z.infer<typeof RoomDimensionsSchema>;

/**
 * Schema for validating quantity takeoffs from plans
 */
export const QuantityTakeoffSchema = z.object({
  item: z.string().min(1, 'Item name is required'),
  quantity: z.number().nonnegative('Quantity cannot be negative'),
  unit: z.string().min(1, 'Unit is required'),
  category: z.string().min(1, 'Category is required'),
  notes: z.string().optional(),
});

export type QuantityTakeoff = z.infer<typeof QuantityTakeoffSchema>;

/**
 * Schema for validating plan/document analysis output
 */
export const PlanAnalysisSchema = z.object({
  documentType: z.enum(['architectural_plan', 'floor_plan', 'elevation', 'section', 'detail', 'site_plan', 'other']),
  scale: z.string().optional(),
  rooms: z.array(RoomDimensionsSchema),
  quantities: z.array(QuantityTakeoffSchema),
  structuralElements: z.object({
    walls: z.number().nonnegative().optional(),
    doors: z.number().nonnegative().optional(),
    windows: z.number().nonnegative().optional(),
    stairs: z.number().nonnegative().optional(),
  }).optional(),
  materials: z.array(z.string()),
  annotations: z.array(z.string()),
  scopeItems: z.array(z.string()).min(1, 'At least one scope item is required'),
  potentialIssues: z.array(z.string()),
  missingInformation: z.array(z.string()),
  confidence: z.number().min(0).max(1, 'Confidence must be between 0 and 1'),
  notes: z.string(),
});

export type PlanAnalysis = z.infer<typeof PlanAnalysisSchema>;

/**
 * Schema for validating combined photo + document analysis
 */
export const CombinedAnalysisSchema = z.object({
  photoAnalyses: z.array(
    z.object({
      url: z.string().url(),
      analysis: PhotoAnalysisSchema,
    })
  ).optional(),
  planAnalyses: z.array(
    z.object({
      documentId: z.string(),
      fileName: z.string(),
      analysis: PlanAnalysisSchema,
    })
  ).optional(),
  summary: z.object({
    overallConfidence: z.number().min(0).max(1),
    primaryTrades: z.array(z.string()),
    totalSquareFootage: z.number().nonnegative().optional(),
    estimatedComplexity: z.enum(['low', 'medium', 'high']),
    dataQuality: z.enum(['poor', 'fair', 'good', 'excellent']),
    recommendAnalyzeDocuments: z.boolean(), // True if photos exist but no plans
  }),
});

export type CombinedAnalysis = z.infer<typeof CombinedAnalysisSchema>;
