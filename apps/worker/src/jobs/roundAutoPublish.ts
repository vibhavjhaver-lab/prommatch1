import type { Job } from "bullmq";
import type { JobPayloads } from "@prommatch/core";
import { loadRoundInput, persistRoundResult } from "@prommatch/core";
import { prisma } from "@prommatch/db";
import { runRound } from "@prommatch/matcher";
import { getEventConfig } from "../lib/config.js";
import { getEnv } from "../env.js";
import { notifyUser } from "../lib/notifyUser.js";

/**
 * The auto-publish counterpart to the admin console's manual
 * create → preview → publish flow (apps/web/server/routers/admin.ts's
 * rounds.*). Only fired when apps/web's /api/cron/tick finds a configured
 * drop (EventConfig.dates.drops[dropIndex]) whose time has passed and
 * that has no MatchRound row yet, which also means this job is naturally
 * idempotent against being enqueued twice for the same drop: the second
 * run's create() below hits the (number, mode) unique constraint and this
 * function returns early.
 */
export async function processRoundAutoPublish(job: Job<JobPayloads["round.autoPublish"]>) {
  const { mode, dropIndex } = job.data;
  const config = await getEventConfig();
  const dropAt = config.dates.drops[dropIndex];
  if (!dropAt) return;

  const existing = await prisma.matchRound.findUnique({ where: { number_mode: { number: dropIndex + 1, mode } } });
  if (existing) return; // already handled (by this job or an organizer) — nothing to do

  const seed = Math.floor(Math.random() * 2 ** 31);
  const decisionDeadline = new Date(Date.parse(dropAt) + config.dates.decisionWindowHours * 60 * 60 * 1000);

  const round = await prisma.matchRound.create({
    data: {
      number: dropIndex + 1,
      mode,
      status: "DRAFT",
      seed,
      params: config.matching,
      scheduledAt: new Date(dropAt),
      decisionDeadline,
      createdById: "system:auto-publish",
    },
  });

  const env = getEnv();
  const roundInput = await loadRoundInput(
    prisma,
    mode,
    { ...config.matching, largeGraphThreshold: 3000 } as Parameters<typeof loadRoundInput>[2],
    { emailHashSalt: env.EMAIL_HASH_SALT },
  );
  const output = runRound(roundInput, seed);
  const persisted = await persistRoundResult(prisma, round.id, mode, output);
  await prisma.matchRound.update({
    where: { id: round.id },
    data: { status: "PUBLISHED", publishedAt: new Date(), stats: output.stats as unknown as object },
  });
  await prisma.auditLog.create({
    data: { actorId: null, action: "round.auto_published", targetType: "MatchRound", targetId: round.id, meta: { mode, dropIndex } },
  });

  const affectedUserIds = new Set<string>();
  if (mode !== "SQUAD") {
    const matches = await prisma.match.findMany({ where: { id: { in: persisted.matchIds } }, select: { userAId: true, userBId: true } });
    for (const m of matches) {
      affectedUserIds.add(m.userAId);
      affectedUserIds.add(m.userBId);
    }
  } else {
    const members = await prisma.squadMember.findMany({ where: { squadId: { in: persisted.squadIds } }, select: { userId: true } });
    for (const m of members) affectedUserIds.add(m.userId);
  }

  await Promise.all(
    [...affectedUserIds].map((userId) =>
      notifyUser(userId, {
        type: "round:published",
        title: "Your Match Drop is here",
        body: mode === "SQUAD" ? "You've been placed in a squad — go take a look." : `New ${mode.toLowerCase()} matches are ready for you.`,
        link: mode === "SQUAD" ? "/squad" : `/matches?mode=${mode}`,
      }),
    ),
  );
}
