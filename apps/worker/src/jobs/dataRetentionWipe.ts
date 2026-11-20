import { prisma } from "@prommatch/db";

/**
 * Performs the destructive wipe admin.data.wipeEvent schedules (48h out,
 * cancellable via admin.data.cancelWipe) by reading the "scheduledWipe"
 * EventConfig row apps/web writes. No-ops if nothing is scheduled, or if
 * the scheduled time hasn't arrived yet.
 *
 * This agent has no network access to run or test a migration/seed
 * against a real database in this sandbox, so this deletion order is
 * reasoned from the schema's own `onDelete: Cascade` annotations rather
 * than verified end-to-end — see DECISIONS.md. Deleting MatchRound
 * cascades to Match/Squad/SquadMember/Conversation/Message/Promposal;
 * deleting STUDENT users cascades to Profile/MatchPreferences/Answer/
 * Photo/Block/Report/Notification/PushSubscription/Feedback/Account/
 * Session. PairHistory has no FK to User or MatchRound, so it's deleted
 * explicitly. Organizers/superadmins are intentionally kept (so someone
 * can still sign in to run next year's event); the question bank and
 * EventConfig itself are left alone for the same reason. AuditLog is
 * kept as the permanent record that this wipe happened.
 */
export async function processDataRetentionWipe() {
  const scheduled = await prisma.eventConfig.findUnique({ where: { key: "scheduledWipe" } });
  if (!scheduled) return { wiped: false, reason: "none_scheduled" as const };

  const { at, requestedBy } = scheduled.value as { at: string; requestedBy: string };
  if (Date.parse(at) > Date.now()) return { wiped: false, reason: "not_due_yet" as const };

  const counts = await prisma.$transaction(async (tx) => {
    const pairHistory = await tx.pairHistory.deleteMany({});
    const announcements = await tx.announcement.deleteMany({});
    const rounds = await tx.matchRound.deleteMany({}); // cascades matches/squads/squadMembers/conversations/messages/promposals
    const users = await tx.user.deleteMany({ where: { role: "STUDENT" } }); // cascades profiles/prefs/answers/photos/blocks/reports/notifications/pushSubs/feedback
    await tx.eventConfig.delete({ where: { key: "scheduledWipe" } });
    return { pairHistory: pairHistory.count, announcements: announcements.count, rounds: rounds.count, users: users.count };
  });

  await prisma.auditLog.create({
    data: { actorId: requestedBy, action: "data.wipe_completed", targetType: "Event", meta: counts },
  });

  return { wiped: true as const, ...counts };
}
