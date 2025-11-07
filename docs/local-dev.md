# Local Development Environment

This guide walks through spinning up Postgres + LocalStack S3, running Prisma migrations, seeding data, and smoke-testing the homeowner intake flow.

## 1. Start infrastructure

```bash
# from the repo root
Docker Desktop (or any docker runtime) must be running
npm run infra:up
```

The docker compose file boots:

- `db`: Postgres 15 with `scopeguard / scopeguard` credentials exposed on `localhost:5432`
- `s3`: LocalStack with the S3 service exposed on `localhost:4566`; `infra/localstack/10-create-s3.sh` auto-creates the `scopeguard-uploads` bucket

Stop services via `npm run infra:down` when you're done.

## 2. Copy env vars

```bash
cp .env.example .env
```

Update the following values to point at the local services:

```
DATABASE_URL="postgresql://scopeguard:scopeguard@127.0.0.1:5432/scopeguard"
SHADOW_DATABASE_URL="postgresql://scopeguard:scopeguard@127.0.0.1:5432/scopeguard-shadow"
AWS_ACCESS_KEY_ID="localstack"
AWS_SECRET_ACCESS_KEY="localstack"
AWS_S3_BUCKET="scopeguard-uploads"
AWS_S3_REGION="us-east-1"
AWS_S3_ENDPOINT="http://127.0.0.1:4566"
AWS_S3_FORCE_PATH_STYLE="true"
AWS_S3_BASE_URL="http://127.0.0.1:4566/scopeguard-uploads"
```

## 3. Run Prisma migrations + seed data

```bash
npm run db:migrate
npm run db:seed
```

This creates the schema and upserts a demo contractor (`scopeguard-builders`) with a few trade types.

## 4. Boot the Next.js app

```bash
npm run dev --workspace=@scopeguard/web
```

Visit `http://localhost:3000/intake/scopeguard-builders` to submit a test lead. Photos will upload to LocalStack, and the lead + photos will persist in Postgres.

## 5. Smoke test uploads via curl (optional)

If you want to test without the UI running, you can hit the API routes directly once `npm run dev` is running:

```bash
curl -X POST http://localhost:3000/api/uploads/presign \
  -H 'Content-Type: application/json' \
  -d '{
        "contractorSlug": "scopeguard-builders",
        "files": [{
          "name": "kitchen.jpg",
          "type": "image/jpeg",
          "size": 1024
        }]
      }'
```

The response will include a presigned URL you can `PUT` to. Afterwards, call `/api/leads` with the photo metadata to verify the DB insert path end-to-end.

## 6. Tear down

When you're done testing:

```bash
npm run infra:down
```

This stops containers but leaves the Postgres volume intact so your test data persists between sessions.
