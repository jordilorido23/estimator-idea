import { inngest } from '../client';
import { prisma } from '@scopeguard/db';
import { analyzeMultiplePlans } from '@/lib/ai/plan-analyzer';
import { generateScopeOfWork } from '@/lib/ai/scope-generator';
import { AIError } from '@/lib/ai/retry';

/**
 * Background job: Analyze construction plans/documents for a lead
 *
 * This function:
 * 1. Analyzes all uploaded documents (PDFs, plans, drawings) using Claude Vision
 * 2. Extracts dimensions, quantities, and scope from plans
 * 3. Generates or updates scope of work (combining with photos if both exist)
 * 4. Stores results in the database
 * 5. Updates lead score based on data quality
 *
 * Features:
 * - Automatic retries on failure (3 attempts)
 * - Exponential backoff
 * - Error tracking and logging
 * - Job status visible in Inngest dashboard
 */

export const analyzeDocumentsFunction = inngest.createFunction(
  {
    id: 'analyze-documents',
    name: 'Analyze Construction Plans',
    retries: 3,
    rateLimit: {
      limit: 5, // Documents are larger, limit concurrency more
      period: '1m',
    },
  },
  { event: 'lead/document.analyze' },
  async ({ event, step }) => {
    const { leadId, documents, leadData } = event.data;

    // Step 1: Fetch lead with existing data
    const lead = await step.run('fetch-lead', async () => {
      const leadWithData = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
          documents: true,
          photos: true,
          takeoffs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!leadWithData) {
        throw new Error(`Lead ${leadId} not found`);
      }

      return leadWithData;
    });

    // Step 2: Analyze documents with Claude Vision
    const documentAnalysisResults = await step.run('analyze-documents', async () => {
      console.log(`[Job] Analyzing ${documents.length} documents for lead ${leadId}`);

      try {
        // Get document IDs from database to match uploaded documents
        const dbDocuments = await prisma.document.findMany({
          where: {
            leadId,
            url: { in: documents.map((d: any) => d.url) },
          },
        });

        const documentsToAnalyze = documents.map((doc: any) => {
          const dbDoc = dbDocuments.find((d) => d.url === doc.url);
          return {
            url: doc.url,
            fileName: doc.fileName,
            fileType: doc.contentType,
            documentId: dbDoc?.id || '',
          };
        });

        const results = await analyzeMultiplePlans(documentsToAnalyze);
        console.log(`[Job] Document analysis complete for lead ${leadId}`);
        return results;
      } catch (error) {
        if (error instanceof AIError) {
          console.error('[Job] AI error during document analysis:', {
            leadId,
            code: error.code,
            message: error.message,
            retryable: error.retryable,
          });
          throw error;
        }
        throw new Error(
          `Document analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    // Step 3: Check if we have existing photo analysis
    const existingTakeoff = lead.takeoffs[0];
    const existingPhotoAnalyses = existingTakeoff?.data
      ? (existingTakeoff.data as any).photoAnalyses
      : null;

    // Step 4: Generate comprehensive scope combining photos AND documents
    const scope = await step.run('generate-scope', async () => {
      console.log(`[Job] Generating scope for lead ${leadId}`);

      try {
        const scopeOfWork = await generateScopeOfWork({
          leadData,
          photoAnalyses: existingPhotoAnalyses?.map((p: any) => p.analysis) || undefined,
          planAnalyses: documentAnalysisResults.map((doc) => ({
            fileName: doc.fileName,
            analysis: doc.analysis,
          })),
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

    // Step 5: Calculate overall confidence from plan analysis
    const avgPlanConfidence =
      documentAnalysisResults.reduce((sum, doc) => sum + doc.analysis.confidence, 0) /
      documentAnalysisResults.length;

    // Combine with photo confidence if available
    const existingPhotoConfidence = existingTakeoff?.confidence || 0;
    const overallConfidence = existingPhotoAnalyses
      ? (avgPlanConfidence + existingPhotoConfidence) / 2
      : avgPlanConfidence;

    // Step 6: Store or update takeoff in database
    const takeoff = await step.run('save-takeoff', async () => {
      console.log(`[Job] Saving takeoff to database for lead ${leadId}`);

      // Determine source type
      const sourceType = existingPhotoAnalyses ? 'HYBRID' : 'DOCUMENT';

      return await prisma.takeoff.create({
        data: {
          leadId,
          tradeType: leadData.tradeType,
          provider: 'anthropic',
          version: 'claude-3-5-sonnet-20241022',
          sourceType,
          documentIds: documentAnalysisResults.map((doc) => doc.documentId),
          confidence: overallConfidence,
          data: {
            ...(existingPhotoAnalyses ? { photoAnalyses: existingPhotoAnalyses } : {}),
            planAnalyses: documentAnalysisResults,
            scopeOfWork: scope,
            analyzedAt: new Date().toISOString(),
          },
        },
      });
    });

    // Step 7: Calculate and update lead score
    const leadScore = await step.run('update-lead-score', async () => {
      const score = calculateLeadScore(
        {
          overallConfidence,
          totalSquareFootage: documentAnalysisResults.reduce(
            (sum, doc) => sum + doc.analysis.rooms.reduce((s, r) => s + (r.area || 0), 0),
            0
          ),
          hasPlans: true,
        },
        leadData
      );

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
      documentsAnalyzed: documents.length,
      sourceType: existingPhotoAnalyses ? 'HYBRID' : 'DOCUMENT',
      overallConfidence,
      score: leadScore,
      totalSquareFootage: documentAnalysisResults.reduce(
        (sum, doc) => sum + doc.analysis.rooms.reduce((s, r) => s + (r.area || 0), 0),
        0
      ),
      scopeSummary: scope.summary,
    };
  }
);

/**
 * Calculate a lead quality score (0-100) based on plan analysis
 * Higher scores indicate better quality leads
 */
function calculateLeadScore(
  analysis: { overallConfidence: number; totalSquareFootage: number; hasPlans: boolean },
  leadData: { budget?: number; timeline?: string; notes?: string }
): number {
  let score = 0;

  // Plan analysis confidence (0-40 points)
  score += analysis.overallConfidence * 40;

  // Has actual plans (20 points) - big boost for having architectural drawings
  if (analysis.hasPlans) score += 20;

  // Project size indicator (0-10 points)
  // Larger projects (>1000 sqft) get more points
  if (analysis.totalSquareFootage > 1000) {
    score += 10;
  } else if (analysis.totalSquareFootage > 500) {
    score += 5;
  }

  // Budget provided (10 points)
  if (leadData.budget) score += 10;

  // Timeline provided (10 points)
  if (leadData.timeline) score += 10;

  // Description provided (10 points)
  if (leadData.notes && leadData.notes.length > 20) score += 10;

  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(score)));
}
