import { prisma } from "@prommatch/db";

const GRACE_PERIOD_DAYS = 7;

/**
 * me.deleteAccount (apps/web) sets status=DELETED immediately but that's
 * only the start of a grace period — this job hard-deletes any account
 * that's been DELETED for more than 7 days and hasn't been cancelled
 * (me.cancelDeletion flips status back to ACTIVE, which takes it out of
 * this query). Every relation off User cascades (see
 * packages/db/prisma/schema.prisma — every `@relation(... onDelete:
 * Cascade)` back to User), so one user.delete() is enough; Match/
 * PairHistory rows (which reference userAId/userBId as plain strings,
 * not a foreign key — see DECISIONS.md if that ever needs revisiting)
 * are deliberately left in place as historical matching data, same as
 * any other student who leaves.
 */
export async function processDataDeleteAccounts() {
  const cutoff = new Date(Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const toDelete = await prisma.user.findMany({
    where: { status: "DELETED", updatedAt: { lt: cutoff } },
    select: { id: true },
  });

  for (const user of toDelete) {
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.auditLog.create({
      data: { actorId: null, action: "account.hard_deleted", targetType: "User", targetId: user.id, meta: {} },
    });
  }

  return { deleted: toDelete.length };
}
