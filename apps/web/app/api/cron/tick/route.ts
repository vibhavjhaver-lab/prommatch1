import { NextResponse, type NextRequest } from "next/server";
import { enqueue } from "@prommatch/core";
import { getEnv } from "../../../../lib/env.js";

/**
 * Pinged on a schedule (every few minutes) by the hosting platform's cron
 * feature (Render Cron Job / Fly Machines schedule / an external pinger).
 * This route itself does no heavy work — it only enqueues BullMQ jobs that
 * apps/worker's processors pick up, so a slow or failing job never blocks
 * the HTTP response and retries are the queue's job, not this route's.
 *
 * Auth: a shared secret in the `x-cron-secret` header, compared to
 * CRON_SECRET from the environment. Never time-varying, so no replay window
 * concerns beyond "don't leak the secret" — this endpoint only enqueues
 * idempotent maintenance jobs, it never mutates data directly.
 */
export async function POST(req: NextRequest) {
  const env = getEnv();
  const provided = req.headers.get("x-cron-secret");
  if (!provided || provided !== env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const jobs = [
    "round.expireDecisions",
    "reminders.decide",
    "reminders.onboarding",
    "announcements.send",
    "chat.autoClose",
    "data.deleteAccounts",
    "data.retentionWipe",
    "digest.organizers",
  ] as const;

  await Promise.all(jobs.map((name) => enqueue(env.REDIS_URL, name, {})));

  return NextResponse.json({ ok: true, enqueued: jobs, at: new Date().toISOString() });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
