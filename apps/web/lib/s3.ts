import { S3Client } from '@aws-sdk/client-s3';

type S3Config = {
  bucket: string;
  region: string;
  baseUrl: string;
  endpoint?: string;
  forcePathStyle: boolean;
};

let cachedClient: S3Client | null = null;
let cachedConfig: S3Config | null = null;

const normalizeUrl = (value: string | undefined | null) =>
  value ? value.replace(/\/+$/, '') : undefined;

const getBaseUrl = (bucket: string, region: string, endpoint?: string) => {
  const configured = normalizeUrl(process.env.AWS_S3_BASE_URL);
  if (configured) {
    return configured;
  }

  if (endpoint) {
    return `${endpoint}/${bucket}`.replace(/([^:]\/)\/+/g, '$1');
  }

  return `https://${bucket}.s3.${region}.amazonaws.com`;
};

export const getS3 = () => {
  const region = process.env.AWS_S3_REGION;
  const bucket = process.env.AWS_S3_BUCKET;

  if (!region || !bucket) {
    throw new Error('Missing AWS_S3_REGION or AWS_S3_BUCKET environment variables');
  }

  const endpoint = normalizeUrl(process.env.AWS_S3_ENDPOINT);
  const forcePathStyle = (process.env.AWS_S3_FORCE_PATH_STYLE ?? 'false').toLowerCase() === 'true';

  if (!cachedClient) {
    cachedClient = new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials:
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
          : undefined
    });
  }

  if (!cachedConfig) {
    cachedConfig = {
      bucket,
      region,
      endpoint,
      forcePathStyle,
      baseUrl: getBaseUrl(bucket, region, endpoint)
    };
  }

  return {
    client: cachedClient,
    config: cachedConfig
  };
};

export const buildPublicS3Url = (key: string) => {
  const {
    config: { baseUrl }
  } = getS3();
  const normalizedKey = key.replace(/^\/+/, '');
  return `${baseUrl}/${normalizedKey}`.replace(/([^:]\/)\/+/g, '$1');
};
