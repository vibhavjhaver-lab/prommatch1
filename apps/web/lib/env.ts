import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  REALTIME_JWT_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(16),
  FIELD_ENCRYPTION_KEY: z.string().min(32),
  EMAIL_HASH_SALT: z.string().min(16),
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  S3_ENDPOINT: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  SMTP_URL: z.string().min(1),
  EMAIL_FROM: z.string().email(),
  APP_URL: z.string().url(),
  REALTIME_URL: z.string().url(),
  SENTRY_DSN: z.string().optional().default(""),
  OPENAI_MODERATION_KEY: z.string().optional().default(""),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/**
 * Validates process.env once and caches it. Throws with a clear message
 * naming every missing/invalid variable — fail fast at boot, not at the
 * first request that happens to touch the missing value.
 */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}\n\nCheck .env against .env.example.`);
  }
  cached = parsed.data;
  return cached;
}
