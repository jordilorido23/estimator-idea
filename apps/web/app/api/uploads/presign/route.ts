import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';

import { buildPublicS3Url, getS3 } from '@/lib/s3';

const presignRequestSchema = z.object({
  contractorSlug: z.string().min(1),
  files: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        type: z.string().min(1),
        size: z.number().positive()
      })
    )
    .min(1)
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { contractorSlug, files } = presignRequestSchema.parse(body);
    const { client, config } = getS3();

    const uploads = await Promise.all(
      files.map(async (file) => {
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_/]/g, '-');
        const objectKey = [
          'contractors',
          contractorSlug,
          'leads',
          new Date().toISOString().split('T')[0],
          `${file.id ?? randomUUID()}-${safeName}`.replace(/\s+/g, '-')
        ]
          .join('/')
          .replace(/\/+/g, '/');

        const command = new PutObjectCommand({
          Bucket: config.bucket,
          Key: objectKey,
          ContentType: file.type
        });

        const uploadUrl = await getSignedUrl(client, command, {
          expiresIn: 60
        });

        return {
          id: file.id,
          key: objectKey,
          uploadUrl,
          url: buildPublicS3Url(objectKey)
        };
      })
    );

    return NextResponse.json({ uploads });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 422 });
    }
    console.error('Presign upload error', error);
    return NextResponse.json({ error: 'Unable to generate upload URLs' }, { status: 500 });
  }
}
