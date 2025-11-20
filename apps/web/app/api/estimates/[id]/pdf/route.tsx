import { NextRequest, NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@scopeguard/db/client';
import { ProposalDocument } from '@/lib/pdf/proposal-generator';
import { getAuth } from '@/lib/test-auth-helpers';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get authenticated user
    const authResult = await getAuth();
    if (!authResult.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch estimate with related data
    const estimate = await prisma.estimate.findUnique({
      where: { id: params.id },
      include: {
        lead: true,
        contractor: true,
      },
    });

    if (!estimate) {
      return NextResponse.json(
        { error: 'Estimate not found' },
        { status: 404 }
      );
    }

    // Verify user has access to this estimate
    // (You may want to add a proper authorization check based on your Clerk/contractor relationship)

    // Prepare data for PDF generation
    const proposalData = {
      contractor: {
        companyName: estimate.contractor.companyName,
        email: estimate.contractor.email,
        phone: estimate.contractor.phone,
      },
      lead: {
        homeownerName: estimate.lead.homeownerName,
        homeownerEmail: estimate.lead.homeownerEmail,
        homeownerPhone: estimate.lead.homeownerPhone,
        address: estimate.lead.address,
      },
      estimate: {
        id: estimate.id,
        lineItems: estimate.lineItems as any[], // Type assertion for JSON field
        subtotal: Number(estimate.subtotal),
        margin: Number(estimate.margin),
        contingency: Number(estimate.contingency),
        total: Number(estimate.total),
        createdAt: estimate.createdAt,
      },
    };

    // Generate PDF
    const stream = await renderToStream(
      <ProposalDocument
        data={proposalData}
        depositPercentage={Number(estimate.contractor.depositPercentage)}
      />
    );

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as any) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Return PDF with proper headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="proposal-${estimate.id}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
