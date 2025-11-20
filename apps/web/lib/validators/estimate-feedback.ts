import { z } from 'zod';

export const estimateFeedbackSchema = z.object({
  projectOutcome: z.enum(['WON', 'LOST', 'IN_PROGRESS', 'CANCELLED']),
  actualCost: z.number().positive().optional(),
  completedAt: z.string().datetime().optional(),
  feedbackNotes: z.string().optional(),
});

export type EstimateFeedbackValues = z.infer<typeof estimateFeedbackSchema>;
