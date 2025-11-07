import { NextResponse } from 'next/server';
import { Prisma, prisma } from '@scopeguard/db';
import { z } from 'zod';

import { leadIntakeSchema } from '@/lib/validators/lead-intake';

const leadSubmissionSchema = leadIntakeSchema.extend({
  contractorSlug: z.string().min(1, 'Contractor slug is required')
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { contractorSlug, photos = [], ...payload } = leadSubmissionSchema.parse(body);

    const contractor = await prisma.contractor.findUnique({
      where: { slug: contractorSlug },
      select: { id: true }
    });

    if (!contractor) {
      return NextResponse.json({ error: 'Contractor not found' }, { status: 404 });
    }

    const lead = await prisma.lead.create({
      data: {
        contractorId: contractor.id,
        homeownerName: payload.homeownerName,
        homeownerEmail: payload.homeownerEmail,
        homeownerPhone: payload.homeownerPhone,
        address: payload.address,
        tradeType: payload.projectType,
        budget: typeof payload.budget === 'number' ? new Prisma.Decimal(payload.budget) : undefined,
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

    return NextResponse.json({ lead });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 422 });
    }
    console.error('Lead submission error', error);
    return NextResponse.json({ error: 'Unable to save lead' }, { status: 500 });
  }
}
