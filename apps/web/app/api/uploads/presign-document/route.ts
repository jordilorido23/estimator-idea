import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { z } from 'zod';

import { prisma } from '@scopeguard/db';
import { buildPublicS3Url, getS3 } from '@/lib/s3';
import { ratelimit, getRateLimitIdentifier, checkRateLimit } from '@/lib/rate-limit';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB for documents/plans
const MAX_DOCUMENTS_PER_LEAD = 10;

// Supported document types
const SUPPORTED_CONTENT_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/dwg',
  'application/dxf',
  'application/vnd.dwg',
  'application/acad',
] as const;

const presignRequestSchema = z.object({
  contractorSlug: z.string().min(1),
  leadTempId: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid leadTempId.'),
  contentType: z
    .string()
    .min(1)
    .refine(
      (value) => SUPPORTED_CONTENT_TYPES.includes(value as any),
      { message: `Content type must be one of: ${SUPPORTED_CONTENT_TYPES.join(', ')}` }
    ),
  fileName: z.string().min(1),
  fileSize: z
    .number()
    .positive()
    .max(MAX_FILE_SIZE, `File size exceeds ${(MAX_FILE_SIZE / (1024 * 1024)).toFixed(0)}MB limit.`)
});

const sanitizeFileName = (fileName: string) => {
  const normalized = fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.\-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'document';
};

export async function POST(request: Request) {
  try {
    // Apply strict rate limiting to prevent abuse
    const identifier = getRateLimitIdentifier(request);
    const rateLimitResult = await checkRateLimit(ratelimit.strict, identifier);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Too many upload requests. Please try again later.',
          resetTime: rateLimitResult.resetTime,
        },
        {
          status: 429,
          headers: rateLimitResult.headers,
        }
      );
    }

    const body = await request.json();
    const { contractorSlug, leadTempId, contentType, fileName, fileSize } = presignRequestSchema.parse(body);

    const contractor = await prisma.contractor.findUnique({
      where: { slug: contractorSlug },
      select: { id: true }
    });

    if (!contractor) {
      return NextResponse.json(
        { error: 'Contractor not found.' },
        { status: 404, headers: rateLimitResult.headers }
      );
    }

    const { client, config } = getS3();

    const safeName = sanitizeFileName(fileName);
    const key = `contractors/${contractorSlug}/temp/${leadTempId}/documents/${randomUUID()}-${safeName}`;

    // Determine if this is a PDF or image based on content type
    const isPDF = contentType === 'application/pdf';
    const isImage = contentType.startsWith('image/');
    const isCAD = contentType.includes('dwg') || contentType.includes('dxf') || contentType.includes('acad');

    // Set appropriate conditions based on file type
    const conditions: any[] = [
      ['content-length-range', 1, MAX_FILE_SIZE],
    ];

    if (isPDF) {
      conditions.push(['eq', '$Content-Type', 'application/pdf']);
    } else if (isImage) {
      conditions.push(['starts-with', '$Content-Type', 'image/']);
    } else if (isCAD) {
      // CAD files have various content types
      conditions.push(['starts-with', '$Content-Type', 'application/']);
    }

    const presignedPost = await createPresignedPost(client, {
      Bucket: config.bucket,
      Key: key,
      Fields: {
        'Content-Type': contentType
      },
      Conditions: conditions,
      Expires: 600 // 10 minutes
    });

    return NextResponse.json(
      {
        upload: {
          url: presignedPost.url,
          fields: presignedPost.fields,
          key,
          bucket: config.bucket,
          maxFileSize: MAX_FILE_SIZE,
          publicUrl: buildPublicS3Url(key),
          contentType,
          fileSize,
        },
      },
      { headers: rateLimitResult.headers }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 422 });
    }
    console.error('Presign document upload error', error);
    return NextResponse.json({ error: 'Unable to generate upload URLs' }, { status: 500 });
  }
}
