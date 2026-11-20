import type { PrismaClient } from "@prommatch/db";

export interface AuditEntry {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}

/**
 * Every write that changes another user's experience (match, report, ban,
 * announcement) must write an AuditLog row in the same transaction — spec
 * section 3, Architecture rules. Call this inside the same `db.$transaction`
 * as the mutation itself, passing the transaction client as `db`.
 */
export async function writeAudit(db: PrismaClient, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      meta: (entry.meta ?? {}) as object,
    },
  });
}
