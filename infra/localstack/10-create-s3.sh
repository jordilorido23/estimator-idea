#!/usr/bin/env bash
set -euo pipefail

BUCKET_NAME=${AWS_S3_BUCKET:-scopeguard-uploads}

if command -v awslocal >/dev/null 2>&1; then
  echo "Creating bucket $BUCKET_NAME via awslocal"
  awslocal s3api create-bucket --bucket "$BUCKET_NAME" --region ${AWS_DEFAULT_REGION:-us-east-1} >/dev/null 2>&1 || true
else
  echo "awslocal command not found; skipping bucket creation"
fi
