#!/usr/bin/env tsx
/**
 * Post-deploy smoke test: hits the public health endpoints and checks
 * direct DB/Redis connectivity, so a deploy that's up but silently
 * broken (wrong DATABASE_URL, Redis unreachable) fails loudly instead of
 * looking fine until the first real request. Run with:
 *   pnpm smoke
 * Reads APP_URL / REALTIME_URL / DATABASE_URL / REDIS_URL from .env.
 */
import "dotenv/config";
import { prisma } from "@prommatch/db";
import IORedis from "ioredis";

type CheckResult = { name: string; ok: boolean; detail?: string };

async function checkHttp(name: string, url: string): Promise<CheckResult> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    return { name, ok: res.ok, detail: `HTTP ${res.status}` };
  } catch (err) {
    return { name, ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function checkDatabase(): Promise<CheckResult> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { name: "database", ok: true };
  } catch (err) {
    return { name: "database", ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const url = process.env.REDIS_URL;
  if (!url) return { name: "redis", ok: false, detail: "REDIS_URL not set" };
  const client = new IORedis(url, { maxRetriesPerRequest: 1, connectTimeout: 5000, lazyConnect: true });
  try {
    await client.connect();
    const pong = await client.ping();
    return { name: "redis", ok: pong === "PONG" };
  } catch (err) {
    return { name: "redis", ok: false, detail: err instanceof Error ? err.message : String(err) };
  } finally {
    client.disconnect();
  }
}

async function main() {
  const appUrl = process.env.APP_URL;
  const realtimeUrl = process.env.REALTIME_URL;

  const checks: Promise<CheckResult>[] = [checkDatabase(), checkRedis()];
  if (appUrl) checks.push(checkHttp("web /api/health", `${appUrl}/api/health`));
  if (realtimeUrl) checks.push(checkHttp("realtime /health", `${realtimeUrl}/health`));

  const results = await Promise.all(checks);
  let allOk = true;
  for (const r of results) {
    console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
    if (!r.ok) allOk = false;
  }

  await prisma.$disconnect();
  process.exit(allOk ? 0 : 1);
}

void main();
