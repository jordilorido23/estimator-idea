import { NextResponse } from 'next/server';
import { prisma } from '@scopeguard/db';
import { analyzeMultiplePhotos } from '@/lib/ai/photo-analyzer';
import { generateScopeOfWork } from '@/lib/ai/scope-generator';

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

    // Fetch lead with photos
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        photos: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.photos.length === 0) {
      return NextResponse.json(
        { error: 'No photos available for analysis' },
        { status: 400 }
      );
    }

    console.log(`Manual analysis triggered for lead ${id} with ${lead.photos.length} photos`);

    // Analyze all photos
    const photoUrls = lead.photos.map((photo) => photo.url);
    const analysisResults = await analyzeMultiplePhotos(photoUrls);

    // Generate scope of work
    const scope = await generateScopeOfWork({
      leadData: {
        homeownerName: lead.homeownerName,
        address: lead.address,
        tradeType: lead.tradeType,
        budget: lead.budgetCents ? lead.budgetCents / 100 : undefined,
        timeline: lead.timeline ?? undefined,
        notes: lead.notes ?? undefined,
      },
      photoAnalyses: analysisResults.photos.map((p) => p.analysis),
    });

    // Store results in Takeoff table
    const takeoff = await prisma.takeoff.create({
      data: {
        leadId: id,
        tradeType: lead.tradeType,
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
      budget: lead.budgetCents ? lead.budgetCents / 100 : undefined,
      timeline: lead.timeline ?? undefined,
      notes: lead.notes ?? undefined,
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
        photoCount: lead.photos.length,
        confidence: analysisResults.summary.overallConfidence,
        primaryTrades: analysisResults.summary.primaryTrades,
        workItemCount: analysisResults.summary.totalWorkItems,
      },
      scopeOfWork: scope,
    });
  } catch (error) {
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
