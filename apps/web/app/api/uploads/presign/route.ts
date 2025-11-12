import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { z } from 'zod';

import { prisma } from '@scopeguard/db';
import { buildPublicS3Url, getS3 } from '@/lib/s3';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

const presignRequestSchema = z.object({
  contractorSlug: z.string().min(1),
  leadTempId: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid leadTempId.'),
  contentType: z
    .string()
    .min(1)
    .refine((value) => value.startsWith('image/'), { message: 'Only image uploads are allowed.' }),
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
  return normalized || 'upload';
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { contractorSlug, leadTempId, contentType, fileName, fileSize } = presignRequestSchema.parse(body);
    const contractor = await prisma.contractor.findUnique({
      where: { slug: contractorSlug },
      select: { id: true }
    });

    if (!contractor) {
      return NextResponse.json({ error: 'Contractor not found.' }, { status: 404 });
    }

    const { client, config } = getS3();

    const safeName = sanitizeFileName(fileName);
    const key = `contractors/${contractorSlug}/temp/${leadTempId}/${randomUUID()}-${safeName}`;

    const presignedPost = await createPresignedPost(client, {
      Bucket: config.bucket,
      Key: key,
      Fields: {
        'Content-Type': contentType
      },
      Conditions: [
        ['content-length-range', 1, MAX_FILE_SIZE],
        ['starts-with', '$Content-Type', 'image/']
      ],
      Expires: 600
    });

    return NextResponse.json({
      upload: {
        url: presignedPost.url,
        fields: presignedPost.fields,
        key,
        bucket: config.bucket,
        maxFileSize: MAX_FILE_SIZE,
        publicUrl: buildPublicS3Url(key),
        contentType,
        fileSize
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 422 });
    }
    console.error('Presign upload error', error);
    return NextResponse.json({ error: 'Unable to generate upload URLs' }, { status: 500 });
  }
}
