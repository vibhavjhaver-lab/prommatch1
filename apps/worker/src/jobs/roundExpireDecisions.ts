import { prisma } from "@prommatch/db";

/**
 * Any PROPOSED match or squad whose round's decision deadline has passed
 * never got a mutual accept, so it's marked EXPIRED rather than left
 * PROPOSED forever (which would otherwise keep showing in a student's
 * "new" tab after the deadline). Runs every cron.tick.
 */
export async function processRoundExpireDecisions() {
  const now = new Date();

  const expiredMatches = await prisma.match.updateMany({
    where: { status: "PROPOSED", round: { decisionDeadline: { lt: now } } },
    data: { status: "EXPIRED" },
  });

  // Individual PENDING decisions on those matches also flip to EXPIRED so
  // the UI doesn't show "waiting on your decision" for a match that's
  // already closed.
  await prisma.match.updateMany({
    where: { status: "EXPIRED", decisionA: "PENDING" },
    data: { decisionA: "EXPIRED" },
  });
  await prisma.match.updateMany({
    where: { status: "EXPIRED", decisionB: "PENDING" },
    data: { decisionB: "EXPIRED" },
  });

  const expiredSquadMembers = await prisma.squadMember.updateMany({
    where: { decision: "PENDING", squad: { round: { decisionDeadline: { lt: now } } } },
    data: { decision: "EXPIRED" },
  });

  return { expiredMatches: expiredMatches.count, expiredSquadMembers: expiredSquadMembers.count };
}
