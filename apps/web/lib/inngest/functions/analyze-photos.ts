import { inngest } from '../client';
import type { InngestEvents } from '../client';
import { prisma } from '@scopeguard/db';
import { analyzeMultiplePhotos } from '@/lib/ai/photo-analyzer';
import { generateScopeOfWork } from '@/lib/ai/scope-generator';
import { AIError } from '@/lib/ai/retry';

/**
 * Background job: Analyze photos for a lead
 *
 * This function:
 * 1. Analyzes all photos using Claude Vision
 * 2. Generates a scope of work from the analysis
 * 3. Stores results in the database
 * 4. Calculates and updates lead score
 *
 * Features:
 * - Automatic retries on failure (3 attempts)
 * - Exponential backoff (1s, 2s, 4s)
 * - Error tracking and logging
 * - Job status visible in Inngest dashboard
 */

export const analyzePhotosFunction = inngest.createFunction(
  {
    id: 'analyze-photos',
    name: 'Analyze Lead Photos',
    retries: 3, // Retry up to 3 times on failure
    rateLimit: {
      // Prevent overwhelming the AI API
      limit: 10, // Max 10 concurrent jobs
      period: '1m', // Per minute
    },
  },
  { event: 'lead/photo.analyze' },
  async ({ event, step }) => {
    const { leadId, photoUrls, leadData } = event.data;

    // Step 1: Analyze photos with Claude Vision
    const analysisResults = await step.run('analyze-photos', async () => {
      console.log(`[Job] Analyzing ${photoUrls.length} photos for lead ${leadId}`);

      try {
        const results = await analyzeMultiplePhotos(photoUrls);
        console.log(`[Job] Photo analysis complete for lead ${leadId}`);
        return results;
      } catch (error) {
        // Re-throw AI errors to trigger retry
        if (error instanceof AIError) {
          console.error('[Job] AI error during photo analysis:', {
            leadId,
            code: error.code,
            message: error.message,
            retryable: error.retryable,
          });
          throw error;
        }
        throw new Error(
          `Photo analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    // Step 2: Generate scope of work
    const scope = await step.run('generate-scope', async () => {
      console.log(`[Job] Generating scope for lead ${leadId}`);

      try {
        const scopeOfWork = await generateScopeOfWork({
          leadData,
          photoAnalyses: analysisResults.photos.map((p) => p.analysis),
        });
        console.log(`[Job] Scope generation complete for lead ${leadId}`);
        return scopeOfWork;
      } catch (error) {
        if (error instanceof AIError) {
          console.error('[Job] AI error during scope generation:', {
            leadId,
            code: error.code,
            message: error.message,
            retryable: error.retryable,
          });
          throw error;
        }
        throw new Error(
          `Scope generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    // Step 3: Store results in database
    const takeoff = await step.run('save-takeoff', async () => {
      console.log(`[Job] Saving takeoff to database for lead ${leadId}`);

      return await prisma.takeoff.create({
        data: {
          leadId,
          tradeType: leadData.tradeType,
          provider: 'anthropic',
          version: 'claude-3-5-sonnet-20241022',
          confidence: analysisResults.summary.overallConfidence,
          data: {
            photoAnalyses: analysisResults.photos,
            summary: analysisResults.summary,
            scopeOfWork: scope,
            analyzedAt: new Date().toISOString(),
          },
        },
      });
    });

    // Step 4: Calculate and update lead score
    const leadScore = await step.run('update-lead-score', async () => {
      const score = calculateLeadScore(analysisResults.summary, leadData);

      await prisma.lead.update({
        where: { id: leadId },
        data: { score },
      });

      console.log(`[Job] Lead ${leadId} score updated to ${score}`);
      return score;
    });

    // Return summary of job execution
    return {
      success: true,
      leadId,
      takeoffId: takeoff.id,
      photosAnalyzed: photoUrls.length,
      overallConfidence: analysisResults.summary.overallConfidence,
      score: leadScore,
      scopeSummary: scope.summary,
    };
  }
);

/**
 * Calculate a lead quality score (0-100)
 * Higher scores indicate better quality leads
 */
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
