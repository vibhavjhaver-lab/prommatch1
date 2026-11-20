import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  REALTIME_JWT_SECRET: z.string().min(32),
  REALTIME_PORT: z.coerce.number().int().positive().default(4000),
  /** Comma-separated list of origins allowed to open a socket connection (the deployed web app's own origin). */
  REALTIME_CORS_ORIGINS: z.string().min(1),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid realtime environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
