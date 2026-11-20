#!/usr/bin/env tsx
import { randomBytes } from "node:crypto";

/**
 * Prints fresh values for every secret .env.example lists as "generate
 * with scripts/generate-secrets.ts". Doesn't write to .env itself —
 * review and paste manually so you never accidentally overwrite a value
 * you meant to keep (e.g. re-running this after already deploying would
 * invalidate every existing session/signed URL if it clobbered .env).
 */
function hex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

const secrets = {
  AUTH_SECRET: hex(32),
  REALTIME_JWT_SECRET: hex(32),
  CRON_SECRET: hex(24),
  FIELD_ENCRYPTION_KEY: hex(32),
  EMAIL_HASH_SALT: hex(24),
};

console.log("# Generated secrets — paste into your .env (do not commit):\n");
for (const [key, value] of Object.entries(secrets)) {
  console.log(`${key}=${value}`);
}
console.log(
  "\n# VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not generated here — run:\n" +
    "#   pnpm --filter @prommatch/worker exec node -e \"console.log(require('web-push').generateVAPIDKeys())\"\n" +
    "# EMAIL_HASH_SALT and REALTIME_JWT_SECRET must be identical across apps/web, apps/worker,\n" +
    "# and apps/realtime wherever each is used — copy the single generated value to each service's env.",
);
