import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@scopeguard/db';
import { auth } from '@clerk/nextjs/server';

// Schema for creating a document
const createDocumentSchema = z.object({
  url: z.string().url(),
  key: z.string().min(1),
  fileName: z.string().min(1),
  fileType: z.enum(['PDF', 'IMAGE', 'DWG', 'OTHER']),
  fileSizeBytes: z.number().positive(),
  metadata: z.record(z.any()).optional(),
});

/**
 * GET /api/leads/[id]/documents
 * Retrieve all documents for a lead
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await auth();
    const userEmail = user.sessionClaims?.email as string | undefined;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const contractorUser = await prisma.contractorUser.findUnique({
      where: { email: userEmail },
    });

    if (!contractorUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify lead belongs to this contractor
    const lead = await prisma.lead.findFirst({
      where: {
        id: params.id,
        contractorId: contractorUser.contractorId,
      },
      include: {
        documents: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      documents: lead.documents,
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leads/[id]/documents
 * Add a document to a lead
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await auth();
    const userEmail = user.sessionClaims?.email as string | undefined;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const contractorUser = await prisma.contractorUser.findUnique({
      where: { email: userEmail },
    });

    if (!contractorUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify lead belongs to this contractor
    const lead = await prisma.lead.findFirst({
      where: {
        id: params.id,
        contractorId: contractorUser.contractorId,
      },
    });

    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const documentData = createDocumentSchema.parse(body);

    // Create the document
    const document = await prisma.document.create({
      data: {
        leadId: params.id,
        url: documentData.url,
        key: documentData.key,
        fileName: documentData.fileName,
        fileType: documentData.fileType,
        fileSizeBytes: documentData.fileSizeBytes,
        metadata: documentData.metadata || {},
      },
    });

    return NextResponse.json({
      document,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid document data', details: error.flatten() },
        { status: 422 }
      );
    }
    console.error('Error creating document:', error);
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/leads/[id]/documents/[documentId]
 * Remove a document from a lead
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await auth();
    const userEmail = user.sessionClaims?.email as string | undefined;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const contractorUser = await prisma.contractorUser.findUnique({
      where: { email: userEmail },
    });

    if (!contractorUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID required' },
        { status: 400 }
      );
    }

    // Verify document belongs to a lead owned by this contractor
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        lead: {
          id: params.id,
          contractorId: contractorUser.contractorId,
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Delete the document
    await prisma.document.delete({
      where: {
        id: documentId,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
