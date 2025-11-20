import { NextResponse } from 'next/server';
import { prisma } from '@scopeguard/db';
import { z } from 'zod';

import { leadIntakeSchema } from '@/lib/validators/lead-intake';
import { sendNewLeadNotification, sendHomeownerConfirmation } from '@/lib/email';
import { env } from '@/src/env';
import { ratelimit, getRateLimitIdentifier, checkRateLimit } from '@/lib/rate-limit';
import { inngest } from '@/lib/inngest/client';

const leadSubmissionSchema = leadIntakeSchema.extend({
  contractorSlug: z.string().min(1, 'Contractor slug is required')
});

export async function POST(request: Request) {
  try {
    // Apply strict rate limiting to prevent abuse
    // This is a public endpoint (homeowners submit leads), so we rate limit by IP
    const identifier = getRateLimitIdentifier(request);
    const rateLimitResult = await checkRateLimit(ratelimit.strict, identifier);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          resetTime: rateLimitResult.resetTime,
        },
        {
          status: 429,
          headers: rateLimitResult.headers,
        }
      );
    }

    const body = await request.json();
    const { contractorSlug, photos = [], documents = [], ...payload } = leadSubmissionSchema.parse(body);

    const contractor = await prisma.contractor.findUnique({
      where: { slug: contractorSlug },
      select: { id: true, companyName: true, email: true }
    });

    if (!contractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    // Convert budget to cents if provided
    const budgetCents = typeof payload.budget === 'number' ? Math.round(payload.budget * 100) : undefined;

    // Helper to map content type to DocumentType enum
    const getDocumentType = (contentType: string): 'PDF' | 'IMAGE' | 'DWG' | 'OTHER' => {
      if (contentType === 'application/pdf') return 'PDF';
      if (contentType.startsWith('image/')) return 'IMAGE';
      if (contentType.includes('dwg') || contentType.includes('dxf')) return 'DWG';
      return 'OTHER';
    };

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
          : undefined,
        documents: documents.length
          ? {
              create: documents.map((doc) => ({
                url: doc.url,
                key: doc.key,
                fileName: doc.name,
                fileType: getDocumentType(doc.type),
                fileSizeBytes: doc.size,
                metadata: {
                  contentType: doc.type
                }
              }))
            }
          : undefined
      },
      include: {
        photos: true,
        documents: true
      }
    });

    // Send email notifications (async, don't block response)
    sendEmailNotifications({
      contractor,
      lead,
      photoCount: photos.length,
      documentCount: documents.length,
    }).catch((error) => {
      console.error('Email notification failed for lead', lead.id, error);
    });

    // Trigger background job for photo analysis if photos were uploaded
    if (photos.length > 0) {
      // Send event to Inngest to process photos in background
      // This is non-blocking and has automatic retry logic
      await inngest.send({
        name: 'lead/photo.analyze',
        data: {
          leadId: lead.id,
          photoUrls: photos.map((p) => p.url),
          leadData: {
            homeownerName: payload.homeownerName,
            address: payload.address,
            tradeType: payload.projectType,
            budget: payload.budget,
            timeline: payload.timeline,
            notes: payload.description,
          },
        },
      });

      console.log(`Queued photo analysis job for lead ${lead.id} with ${photos.length} photos`);
    }

    // Trigger background job for document analysis if documents were uploaded
    if (documents.length > 0) {
      await inngest.send({
        name: 'lead/document.analyze',
        data: {
          leadId: lead.id,
          documents: documents.map((doc) => ({
            url: doc.url,
            fileName: doc.name,
            contentType: doc.type,
          })),
          leadData: {
            homeownerName: payload.homeownerName,
            address: payload.address,
            tradeType: payload.projectType,
            budget: payload.budget,
            timeline: payload.timeline,
            notes: payload.description,
          },
        },
      });

      console.log(`Queued document analysis job for lead ${lead.id} with ${documents.length} documents`);
    }

    return NextResponse.json({ lead }, { headers: rateLimitResult.headers });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 422 });
    }
    console.error('Lead submission error', error);
    return NextResponse.json({ error: 'Unable to save lead' }, { status: 500 });
  }
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
