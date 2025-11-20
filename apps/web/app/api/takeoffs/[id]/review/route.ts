import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@scopeguard/db';
import { analyzeTakeoffAccuracy } from '@/lib/ai/review-analyzer';
import { getAuth } from '@/lib/test-auth-helpers';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await getAuth();
    if (!authResult.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const takeoffId = params.id;

    // Get user email from auth
    const userEmail = authResult.sessionClaims?.email as string | undefined;
    if (!userEmail) {
      return NextResponse.json({ error: 'User email not found' }, { status: 401 });
    }

    // Get contractor user
    const contractorUser = await prisma.contractorUser.findUnique({
      where: { email: userEmail },
    });

    if (!contractorUser) {
      return NextResponse.json({ error: 'Contractor user not found' }, { status: 403 });
    }

    // Verify takeoff exists and belongs to contractor
    const takeoff = await prisma.takeoff.findFirst({
      where: {
        id: takeoffId,
        lead: {
          contractorId: contractorUser.contractorId,
        },
      },
      include: {
        lead: {
          include: {
            photos: true,
            estimates: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!takeoff) {
      return NextResponse.json(
        { error: 'Takeoff not found' },
        { status: 404 }
      );
    }

    // Prepare actual outcome data if available
    const latestEstimate = takeoff.lead.estimates[0];
    const actualOutcome = latestEstimate
      ? {
          actualCost: latestEstimate.actualCost?.toNumber(),
          estimatedTotal: latestEstimate.total.toNumber(),
          variance: latestEstimate.variance?.toNumber(),
          feedbackNotes: latestEstimate.feedbackNotes || undefined,
        }
      : undefined;

    // Prepare photos data
    const photos = takeoff.lead.photos.map((photo) => ({
      url: photo.url,
      description: photo.description || undefined,
    }));

    // Analyze the takeoff using AI
    const analysis = await analyzeTakeoffAccuracy({
      takeoffData: takeoff.data,
      photos: photos.length > 0 ? photos : undefined,
      tradeType: takeoff.lead.tradeType,
      actualOutcome,
    });

    // Save the review results to the database
    const updatedTakeoff = await prisma.takeoff.update({
      where: { id: takeoffId },
      data: {
        reviewedAt: new Date(),
        accuracyFeedback: analysis.feedback as any,
        overallAccuracy: analysis.overallAccuracy,
        reviewNotes: analysis.summary,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        takeoffId: updatedTakeoff.id,
        analysis,
      },
    });
  } catch (error) {
    console.error('Error analyzing takeoff:', error);

    return NextResponse.json(
      {
        error: 'Failed to analyze takeoff',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const takeoffId = params.id;

    // Get existing review data
    const takeoff = await prisma.takeoff.findFirst({
      where: {
        id: takeoffId,
        lead: {
          contractorId: {
            not: null,
          },
          contractor: {
            users: {
              some: {
                clerkUserId: userId,
              },
            },
          },
        },
      },
      select: {
        id: true,
        reviewedAt: true,
        accuracyFeedback: true,
        overallAccuracy: true,
        reviewNotes: true,
      },
    });

    if (!takeoff) {
      return NextResponse.json(
        { error: 'Takeoff not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        hasReview: !!takeoff.reviewedAt,
        reviewedAt: takeoff.reviewedAt,
        overallAccuracy: takeoff.overallAccuracy,
        feedback: takeoff.accuracyFeedback,
        summary: takeoff.reviewNotes,
      },
    });
  } catch (error) {
    console.error('Error fetching takeoff review:', error);

    return NextResponse.json(
      { error: 'Failed to fetch review' },
      { status: 500 }
    );
  }
}
