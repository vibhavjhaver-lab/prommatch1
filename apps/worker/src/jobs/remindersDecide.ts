import { prisma } from "@prommatch/db";
import { notifyUser } from "../lib/notifyUser.js";

const REMIND_WINDOW_HOURS = 24;

/**
 * Nudges students with a PENDING decision on a match/squad whose round
 * deadline is within the next 24 hours. Matches/AuditLog don't track
 * "already reminded" state, so this re-notifies on every tick within the
 * window (every few minutes) — acceptable for a prom app's scale, but if
 * that gets noisy, the fix is a `remindedAt` column on Match/SquadMember
 * rather than anything clever here.
 */
export async function processRemindersDecide() {
  const now = new Date();
  const soon = new Date(now.getTime() + REMIND_WINDOW_HOURS * 60 * 60 * 1000);

  const matches = await prisma.match.findMany({
    where: {
      status: "PROPOSED",
      round: { decisionDeadline: { gte: now, lte: soon } },
      OR: [{ decisionA: "PENDING" }, { decisionB: "PENDING" }],
    },
    select: { userAId: true, userBId: true, decisionA: true, decisionB: true, mode: true },
  });

  let reminded = 0;
  for (const m of matches) {
    if (m.decisionA === "PENDING") {
      await notifyUser(m.userAId, {
        type: "match:decision_reminder",
        title: "Decide soon",
        body: "A match proposal is about to expire — take a look before it's gone.",
        link: `/matches?mode=${m.mode}`,
      });
      reminded++;
    }
    if (m.decisionB === "PENDING") {
      await notifyUser(m.userBId, {
        type: "match:decision_reminder",
        title: "Decide soon",
        body: "A match proposal is about to expire — take a look before it's gone.",
        link: `/matches?mode=${m.mode}`,
      });
      reminded++;
    }
  }

  const squadMembers = await prisma.squadMember.findMany({
    where: { decision: "PENDING", squad: { round: { decisionDeadline: { gte: now, lte: soon } } } },
    select: { userId: true },
  });
  for (const sm of squadMembers) {
    await notifyUser(sm.userId, {
      type: "squad:decision_reminder",
      title: "Decide soon",
      body: "Your squad invite is about to expire — take a look before it's gone.",
      link: "/squad",
    });
    reminded++;
  }

  return { reminded };
}
