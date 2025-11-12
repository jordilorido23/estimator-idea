import { z } from "zod"

/**
 * Server-side environment variables schema
 * These are only available on the server and MUST NOT be exposed to the client
 */
const serverSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  SHADOW_DATABASE_URL: z.string().url().optional(),

  // Clerk Auth
  CLERK_SECRET_KEY: z.string().min(1),

  // AWS S3
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().min(1),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),

  // Node environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
})

/**
 * Client-side environment variables schema
 * These are exposed to the browser and MUST be prefixed with NEXT_PUBLIC_
 */
const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().startsWith("pk_"),
})

/**
 * Combined schema for validation
 * @internal
 */
const envSchema = serverSchema.merge(clientSchema)

/**
 * Extract client-side env vars from process.env
 * Only NEXT_PUBLIC_ prefixed vars are included
 */
const getClientEnv = () => {
  return {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  }
}

/**
 * Extract server-side env vars from process.env
 */
const getServerEnv = () => {
  return {
    DATABASE_URL: process.env.DATABASE_URL,
    SHADOW_DATABASE_URL: process.env.SHADOW_DATABASE_URL,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    S3_BUCKET: process.env.S3_BUCKET,
    S3_REGION: process.env.S3_REGION,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  }
}

/**
 * Validate and parse environment variables
 * Throws an error if validation fails
 */
const parseEnv = () => {
  // Skip validation in build time if vars aren't set (allows CI to build without real secrets)
  if (process.env.SKIP_ENV_VALIDATION === "true") {
    console.warn("⚠️  Skipping environment validation")
    return {
      ...getClientEnv(),
      ...getServerEnv(),
    } as z.infer<typeof envSchema>
  }

  const merged = {
    ...getClientEnv(),
    ...getServerEnv(),
  }

  const parsed = envSchema.safeParse(merged)

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:", JSON.stringify(parsed.error.format(), null, 2))
    throw new Error("Invalid environment variables")
  }

  return parsed.data
}

/**
 * Validated environment variables
 * Use this throughout your application instead of process.env
 */
export const env = parseEnv()

/**
 * Client-safe environment variables
 * Only includes NEXT_PUBLIC_ prefixed variables
 */
export const clientEnv: z.infer<typeof clientSchema> = {
  NEXT_PUBLIC_SITE_URL: env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
}

/**
 * Type-safe environment variable access
 * Prevents accidentally using server vars on the client
 */
export type Env = z.infer<typeof envSchema>
export type ClientEnv = z.infer<typeof clientSchema>
export type ServerEnv = z.infer<typeof serverSchema>
