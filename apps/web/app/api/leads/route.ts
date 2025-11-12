import { NextResponse } from 'next/server';
import { prisma } from '@scopeguard/db';
import { z } from 'zod';

import { leadIntakeSchema } from '@/lib/validators/lead-intake';
import { analyzeMultiplePhotos } from '@/lib/ai/photo-analyzer';
import { generateScopeOfWork } from '@/lib/ai/scope-generator';
import { sendNewLeadNotification, sendHomeownerConfirmation } from '@/lib/email';
import { env } from '@/src/env';

const leadSubmissionSchema = leadIntakeSchema.extend({
  contractorSlug: z.string().min(1, 'Contractor slug is required')
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { contractorSlug, photos = [], ...payload } = leadSubmissionSchema.parse(body);

    const contractor = await prisma.contractor.findUnique({
      where: { slug: contractorSlug },
      select: { id: true, companyName: true, email: true }
    });

    if (!contractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    // Convert budget to cents if provided
    const budgetCents = typeof payload.budget === 'number' ? Math.round(payload.budget * 100) : undefined;

    const lead = await prisma.lead.create({
      data: {
        contractorId: contractor.id,
        homeownerName: payload.homeownerName,
        homeownerEmail: payload.homeownerEmail,
        homeownerPhone: payload.homeownerPhone,
        address: payload.address,
        tradeType: payload.projectType,
        budgetCents,
        timeline: payload.timeline ?? null,
        notes: payload.description,
        photos: photos.length
          ? {
              create: photos.map((photo) => ({
                url: photo.url,
                key: photo.key,
                metadata: {
                  name: photo.name,
                  type: photo.type,
                  size: photo.size
                }
              }))
            }
          : undefined
      },
      include: {
        photos: true
      }
    });

    // Send email notifications (async, don't block response)
    sendEmailNotifications({
      contractor,
      lead,
      photoCount: photos.length,
    }).catch((error) => {
      console.error('Email notification failed for lead', lead.id, error);
    });

    // Trigger async photo analysis if photos were uploaded
    if (photos.length > 0) {
      // Run analysis asynchronously (don't await - return response immediately)
      analyzeLeadPhotos(lead.id, photos.map((p) => p.url), {
        homeownerName: payload.homeownerName,
        address: payload.address,
        tradeType: payload.projectType,
        budget: payload.budget,
        timeline: payload.timeline,
        notes: payload.description,
      }).catch((error) => {
        console.error('Photo analysis failed for lead', lead.id, error);
      });
    }

    return NextResponse.json({ lead });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 422 });
    }
    console.error('Lead submission error', error);
    return NextResponse.json({ error: 'Unable to save lead' }, { status: 500 });
  }
}

/**
 * Analyze photos for a lead and store results
 * This runs asynchronously after lead creation
 */
async function analyzeLeadPhotos(
  leadId: string,
  photoUrls: string[],
  leadData: {
    homeownerName: string;
    address: string;
    tradeType: string;
    budget?: number;
    timeline?: string;
    notes?: string;
  }
) {
  try {
    console.log(`Starting photo analysis for lead ${leadId} with ${photoUrls.length} photos`);

    // Analyze all photos
    const analysisResults = await analyzeMultiplePhotos(photoUrls);

    // Generate scope of work
    const scope = await generateScopeOfWork({
      leadData,
      photoAnalyses: analysisResults.photos.map((p) => p.analysis),
    });

    // Store results in Takeoff table
    await prisma.takeoff.create({
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

    // Update lead score based on analysis quality
    const score = calculateLeadScore(analysisResults.summary, leadData);
    await prisma.lead.update({
      where: { id: leadId },
      data: { score },
    });

    console.log(`Photo analysis complete for lead ${leadId}, score: ${score}`);
  } catch (error) {
    console.error(`Photo analysis error for lead ${leadId}:`, error);
    throw error;
  }
}

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

/**
 * Send email notifications for new lead
 */
async function sendEmailNotifications(data: {
  contractor: { id: string; companyName: string; email: string };
  lead: any;
  photoCount: number;
}) {
  const dashboardUrl = `${env.NEXT_PUBLIC_SITE_URL}/dashboard/leads/${data.lead.id}`;

  // Send notification to contractor
  await sendNewLeadNotification({
    contractorName: data.contractor.companyName,
    contractorEmail: data.contractor.email,
    leadId: data.lead.id,
    homeownerName: data.lead.homeownerName,
    homeownerEmail: data.lead.homeownerEmail,
    homeownerPhone: data.lead.homeownerPhone,
    address: data.lead.address,
    tradeType: data.lead.tradeType,
    budget: data.lead.budgetCents ? data.lead.budgetCents / 100 : undefined,
    timeline: data.lead.timeline,
    description: data.lead.notes,
    photoCount: data.photoCount,
    dashboardUrl,
  });

  // Send confirmation to homeowner
  await sendHomeownerConfirmation({
    homeownerName: data.lead.homeownerName,
    homeownerEmail: data.lead.homeownerEmail,
    contractorName: data.contractor.companyName,
    tradeType: data.lead.tradeType,
  });
}
