import { NextResponse, type NextRequest } from "next/server";
import { enqueue } from "@prommatch/core";
import { prisma } from "@prommatch/db";
import { getEventConfig } from "../../../../lib/config.js";
import { getEnv } from "../../../../lib/env.js";

/**
 * Finds any configured drop (EventConfig.dates.drops[i], per mode) whose
 * time has passed and that has no MatchRound row yet, and enqueues
 * round.autoPublish for it — but only when EventConfig.matching.autoPublishRounds
 * is on; otherwise drops are organizer-triggered via the admin console's
 * Rounds page, same as always. One job per due (mode, dropIndex) pair,
 * so a missed tick just means they go out on the next one — findFirst
 * below makes re-running this harmless (idempotent).
 */
async function enqueueDueAutoPublishRounds(redisUrl: string) {
  const config = await getEventConfig();
  if (!config.matching.autoPublishRounds) return [] as const;

  const now = Date.now();
  const dueJobs: { mode: "DATE" | "FRIEND" | "SQUAD"; dropIndex: number }[] = [];

  for (const mode of config.modes as ("DATE" | "FRIEND" | "SQUAD")[]) {
    for (let dropIndex = 0; dropIndex < config.dates.drops.length; dropIndex++) {
      const dropAt = Date.parse(config.dates.drops[dropIndex]!);
      if (dropAt > now) continue;
      const existing = await prisma.matchRound.findUnique({
        where: { number_mode: { number: dropIndex + 1, mode } },
      });
      if (existing) continue;
      dueJobs.push({ mode, dropIndex });
    }
  }

  await Promise.all(dueJobs.map((job) => enqueue(redisUrl, "round.autoPublish", job)));
  return dueJobs;
}

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

  const [, autoPublished] = await Promise.all([
    Promise.all(jobs.map((name) => enqueue(env.REDIS_URL, name, {}))),
    enqueueDueAutoPublishRounds(env.REDIS_URL),
  ]);

  return NextResponse.json({ ok: true, enqueued: jobs, autoPublishRounds: autoPublished, at: new Date().toISOString() });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
