import { NextResponse } from 'next/server';
import { prisma, Prisma } from '@scopeguard/db';
import { generateEstimate } from '@/lib/ai/estimate-generator';

type RouteContext = {
  params: {
    id: string;
  };
};

/**
 * Generate a new estimate for a lead
 * POST /api/leads/[id]/estimate
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: leadId } = context.params;
    const body = await request.json();

    // Fetch lead with takeoff data
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        takeoffs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const latestTakeoff = lead.takeoffs[0];
    if (!latestTakeoff) {
      return NextResponse.json(
        { error: 'No analysis available. Run photo analysis first.' },
        { status: 400 }
      );
    }

    const takeoffData = latestTakeoff.data as any;
    const scopeOfWork = takeoffData.scopeOfWork;

    if (!scopeOfWork) {
      return NextResponse.json(
        { error: 'Invalid takeoff data' },
        { status: 400 }
      );
    }

    console.log(`Generating estimate for lead ${leadId}`);

    // Generate estimate using AI
    const estimate = await generateEstimate({
      scopeOfWork,
      tradeType: lead.tradeType,
      pricingGuidelines: body.pricingGuidelines,
    });

    // Store estimate in database
    const savedEstimate = await prisma.estimate.create({
      data: {
        leadId,
        contractorId: lead.contractorId,
        lineItems: estimate.lineItems,
        subtotal: new Prisma.Decimal(estimate.subtotal),
        margin: new Prisma.Decimal(estimate.marginPercentage),
        contingency: new Prisma.Decimal(estimate.contingencyPercentage),
        total: new Prisma.Decimal(estimate.total),
        confidence: latestTakeoff.confidence
          ? (latestTakeoff.confidence > 0.8 ? 'HIGH' : latestTakeoff.confidence > 0.5 ? 'MEDIUM' : 'LOW')
          : 'MEDIUM',
        status: 'DRAFT',
      },
    });

    // Update lead status
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: 'ESTIMATED' },
    });

    console.log(`Estimate created: ${savedEstimate.id}`);

    return NextResponse.json({
      success: true,
      estimateId: savedEstimate.id,
      estimate: {
        ...estimate,
        id: savedEstimate.id,
      },
    });
  } catch (error) {
    console.error('Estimate generation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate estimate',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Update an existing estimate
 * PATCH /api/leads/[id]/estimate?estimateId=...
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: leadId } = context.params;
    const { searchParams } = new URL(request.url);
    const estimateId = searchParams.get('estimateId');

    if (!estimateId) {
      return NextResponse.json(
        { error: 'estimateId query parameter is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { lineItems, marginPercentage, contingencyPercentage, status } = body;

    // Verify estimate belongs to this lead
    const estimate = await prisma.estimate.findFirst({
      where: {
        id: estimateId,
        leadId,
      },
    });

    if (!estimate) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });
    }

    // Recalculate totals if line items changed
    let updateData: any = {};

    if (lineItems || marginPercentage !== undefined || contingencyPercentage !== undefined) {
      const items = lineItems || estimate.lineItems;
      const margin = marginPercentage !== undefined ? marginPercentage : estimate.margin.toNumber();
      const contingency = contingencyPercentage !== undefined ? contingencyPercentage : estimate.contingency.toNumber();

      const subtotal = (items as any[]).reduce((sum, item) => sum + item.totalCost, 0);
      const marginAmount = subtotal * (margin / 100);
      const contingencyAmount = subtotal * (contingency / 100);
      const total = subtotal + marginAmount + contingencyAmount;

      updateData = {
        lineItems: items,
        subtotal: new Prisma.Decimal(subtotal),
        margin: new Prisma.Decimal(margin),
        contingency: new Prisma.Decimal(contingency),
        total: new Prisma.Decimal(total),
      };
    }

    if (status) {
      updateData.status = status;
    }

    const updatedEstimate = await prisma.estimate.update({
      where: { id: estimateId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      estimate: updatedEstimate,
    });
  } catch (error) {
    console.error('Estimate update error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update estimate',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
