# ScopeGuard

ScopeGuard is an AI-first preconstruction and estimating workspace for residential contractors. This monorepo is powered by Turborepo with a Next.js application, shared UI kit, Prisma data layer, and reusable configs so we can iterate on homeowner intake flows, contractor dashboards, and estimating workflows quickly.

## Monorepo layout

```
scopeguard/
├── apps/
│   └── web/                  # Next.js App Router app (intake + dashboard)
├── packages/
│   ├── ui/                   # Shared shadcn/ui component library
│   ├── db/                   # Prisma schema & client helpers
│   ├── typescript-config/    # Shared tsconfig presets
│   └── eslint-config/        # Shared ESLint rules
├── turbo.json                # Turborepo pipeline
├── package.json              # Workspace scripts & dependencies
└── .env.example              # Environment variable contract
```

## Tech stack

- **Frontend**: Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API routes with Prisma ORM and PostgreSQL
- **Auth**: Clerk (middleware + provider already wired)
- **Storage**: AWS S3 (credentials pulled from env at runtime)
- **Payments**: Stripe (keys stored in env, integration stubbed for later)

## Getting started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment variables**
   ```bash
   cp .env.example .env
   ```
   Fill in the values for PostgreSQL, Clerk, AWS, and Stripe before running the app locally.

3. **Generate the Prisma client**
   ```bash
   npm run db:generate
   ```
   (Add `DATABASE_URL`/`SHADOW_DATABASE_URL` in `.env` beforehand.)

4. **Run the web app**
   ```bash
   npm run dev
   ```
   Turborepo will start the Next.js app on `http://localhost:3000`.

> Want a full local stack (Postgres + S3) plus migration + seed guidance? See [docs/local-dev.md](docs/local-dev.md).

## Useful scripts

- `npm run dev` – Run all `dev` targets via Turborepo (currently the `web` app)
- `npm run build` – Build every package/app
- `npm run lint` – ESLint using the shared config
- `npm run format` – Check formatting with Prettier (`format:write` to fix)
- `npm run db:generate` – `prisma generate` in `packages/db`
- `npm run db:migrate` – `prisma migrate dev`
- `npm run db:seed` – Seed demo contractors and trades
- `npm run db:studio` – Launch Prisma Studio
- `npm run infra:up` / `npm run infra:down` – Start/stop the local Postgres + LocalStack S3 containers

## Next steps

- Wire Clerk keys in `.env` and configure organizations / roles as needed.
- Point `DATABASE_URL` to your Postgres instance and run `npm run db:migrate` to create the schema, followed by `npm run db:seed` for demo data.
- Configure AWS S3 + Stripe keys, then add API routes / server actions to use them.
- Extend the shared UI package with additional shadcn components as product needs grow.
