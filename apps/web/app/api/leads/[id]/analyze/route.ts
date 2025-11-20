import { NextResponse } from 'next/server';
import { prisma } from '@scopeguard/db';
import { analyzeMultiplePhotos } from '@/lib/ai/photo-analyzer';
import { generateScopeOfWork } from '@/lib/ai/scope-generator';
import { verifyLeadOwnership, handleAuthError } from '@/lib/auth-helpers';
import { checkRateLimit, ratelimit } from '@/lib/rate-limit';

type RouteContext = {
  params: {
    id: string;
  };
};

/**
 * Manually trigger analysis for a lead
 * POST /api/leads/[id]/analyze
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = context.params;

    // Check authorization - verify user owns this lead
    const { lead, contractorUser } = await verifyLeadOwnership(id);

    // Rate limiting - prevent AI cost abuse
    const identifier = `analyze:${contractorUser.contractorId}`;
    const rateLimitResult = await checkRateLimit(ratelimit.moderate, identifier);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: rateLimitResult.reset,
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.reset.toString(),
          },
        }
      );
    }

    // Fetch lead with photos (need to refetch to get photos)
    const leadWithPhotos = await prisma.lead.findUnique({
      where: { id },
      include: {
        photos: true,
      },
    });

    if (!leadWithPhotos || leadWithPhotos.photos.length === 0) {
      return NextResponse.json(
        { error: 'No photos available for analysis' },
        { status: 400 }
      );
    }

    console.log(`Manual analysis triggered for lead ${id} with ${leadWithPhotos.photos.length} photos`);

    // Analyze all photos
    const photoUrls = leadWithPhotos.photos.map((photo) => photo.url);
    const analysisResults = await analyzeMultiplePhotos(photoUrls);

    // Generate scope of work
    const scope = await generateScopeOfWork({
      leadData: {
        homeownerName: leadWithPhotos.homeownerName,
        address: leadWithPhotos.address,
        tradeType: leadWithPhotos.tradeType,
        budget: leadWithPhotos.budgetCents ? leadWithPhotos.budgetCents / 100 : undefined,
        timeline: leadWithPhotos.timeline ?? undefined,
        notes: leadWithPhotos.notes ?? undefined,
      },
      photoAnalyses: analysisResults.photos.map((p) => p.analysis),
    });

    // Store results in Takeoff table
    const takeoff = await prisma.takeoff.create({
      data: {
        leadId: id,
        tradeType: leadWithPhotos.tradeType,
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

    // Update lead score
    const score = calculateLeadScore(analysisResults.summary, {
      budget: leadWithPhotos.budgetCents ? leadWithPhotos.budgetCents / 100 : undefined,
      timeline: leadWithPhotos.timeline ?? undefined,
      notes: leadWithPhotos.notes ?? undefined,
    });

    await prisma.lead.update({
      where: { id },
      data: { score, status: 'QUALIFIED' },
    });

    console.log(`Analysis complete for lead ${id}, score: ${score}`);

    return NextResponse.json({
      success: true,
      takeoffId: takeoff.id,
      score,
      summary: {
        photoCount: leadWithPhotos.photos.length,
        confidence: analysisResults.summary.overallConfidence,
        primaryTrades: analysisResults.summary.primaryTrades,
        workItemCount: analysisResults.summary.totalWorkItems,
      },
      scopeOfWork: scope,
    });
  } catch (error) {
    // Handle authorization errors
    const authErrorResponse = handleAuthError(error);
    if (authErrorResponse.status !== 500) {
      return authErrorResponse;
    }

    console.error('Analysis error:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze lead',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Get analysis results for a lead
 * GET /api/leads/[id]/analyze
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = context.params;

    // Check authorization - verify user owns this lead
    await verifyLeadOwnership(id);

    // Fetch most recent takeoff for this lead
    const takeoff = await prisma.takeoff.findFirst({
      where: { leadId: id },
      orderBy: { createdAt: 'desc' },
    });

    if (!takeoff) {
      return NextResponse.json(
        { error: 'No analysis found for this lead' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      takeoffId: takeoff.id,
      confidence: takeoff.confidence,
      data: takeoff.data,
      createdAt: takeoff.createdAt,
    });
  } catch (error) {
    // Handle authorization errors
    const authErrorResponse = handleAuthError(error);
    if (authErrorResponse.status !== 500) {
      return authErrorResponse;
    }

    console.error('Error fetching analysis:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analysis' },
      { status: 500 }
    );
  }
}

function calculateLeadScore(
  summary: { overallConfidence: number; totalWorkItems: number; hasSafetyHazards: boolean },
  leadData: { budget?: number; timeline?: string; notes?: string }
): number {
  let score = 0;

  score += summary.overallConfidence * 40;
  score += Math.min(summary.totalWorkItems / 5, 1) * 20;
  if (leadData.budget) score += 10;
  if (leadData.timeline) score += 10;
  if (leadData.notes && leadData.notes.length > 20) score += 10;
  if (summary.hasSafetyHazards) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}
