#!/usr/bin/env tsx
import { existsSync, copyFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

/**
 * First-run setup. Run this right after cloning — this agent built the
 * whole repo without network access (see DECISIONS.md's first entry), so
 * `pnpm install` has never actually been run against it; this script is
 * the thing to run first, and `pnpm check` right after to catch whatever
 * install/typecheck surfaces.
 */
const root = path.resolve(import.meta.dirname, "..");

function run(cmd: string) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd: root, stdio: "inherit" });
}

console.log("PromMatch setup\n================\n");

const envPath = path.join(root, ".env");
const envExamplePath = path.join(root, ".env.example");
if (!existsSync(envPath)) {
  copyFileSync(envExamplePath, envPath);
  console.log("Created .env from .env.example — fill in the real values before continuing.");
  console.log("Run `pnpm generate:secrets` for the ones that are just random strings.\n");
} else {
  console.log(".env already exists, leaving it alone.\n");
}

run("pnpm install");
run("pnpm db:generate");

console.log(
  "\nNext steps:\n" +
    "  1. Fill in .env (DATABASE_URL, REDIS_URL, S3_*, SMTP_URL, VAPID_*, etc.) — see .env.example for what each does.\n" +
    "  2. `docker compose -f infra/docker-compose.yml up -d` for local Postgres/Redis/MinIO, or point at hosted ones.\n" +
    "  3. `pnpm db:migrate:dev` to create the schema.\n" +
    "  4. `pnpm seed:demo` for sample data (optional, dev only).\n" +
    "  5. `pnpm dev:all` to run web + worker + realtime together.\n" +
    "  6. `pnpm check` to run lint + typecheck + test + build — this has NOT been run yet in this sandbox, so expect to fix things here first.\n",
);
