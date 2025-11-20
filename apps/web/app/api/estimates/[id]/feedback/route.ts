import { NextResponse } from 'next/server';
import { prisma } from '@scopeguard/db';
import { z } from 'zod';
import { estimateFeedbackSchema } from '@/lib/validators/estimate-feedback';
import { Decimal } from '@prisma/client/runtime/library';
import { verifyEstimateOwnership, handleAuthError } from '@/lib/auth-helpers';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const estimateId = params.id;

    // Check authorization - verify user owns this estimate
    const { estimate } = await verifyEstimateOwnership(estimateId);

    const body = await request.json();
    const payload = estimateFeedbackSchema.parse(body);

    // Calculate variance if actualCost is provided
    let variance: Decimal | null = null;
    let variancePercent: Decimal | null = null;

    if (payload.actualCost !== undefined && payload.actualCost !== null) {
      const estimateTotal = estimate.total.toNumber();
      variance = new Decimal(payload.actualCost).minus(estimateTotal);

      if (estimateTotal > 0) {
        variancePercent = variance.div(estimateTotal).mul(100);
      }
    }

    // Update estimate with feedback
    const updatedEstimate = await prisma.estimate.update({
      where: { id: estimateId },
      data: {
        projectOutcome: payload.projectOutcome,
        actualCost: payload.actualCost !== undefined
          ? new Decimal(payload.actualCost)
          : null,
        completedAt: payload.completedAt
          ? new Date(payload.completedAt)
          : null,
        feedbackNotes: payload.feedbackNotes,
        variance,
        variancePercent,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedEstimate
    });
  } catch (error) {
    // Handle authorization errors
    const authErrorResponse = handleAuthError(error);
    if (authErrorResponse.status !== 500) {
      return authErrorResponse;
    }

    console.error('Error saving estimate feedback:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.flatten() },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500 }
    );
  }
}
