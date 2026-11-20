import { TRPCError } from "@trpc/server";
import { enqueue } from "@prommatch/core";
import { getEnv } from "../../lib/env.js";
import { protectedProcedure, router } from "../trpc.js";

export const meRouter = router({
  requestDataExport: protectedProcedure.mutation(async ({ ctx }) => {
    await enqueue(getEnv().REDIS_URL, "data.export", { userId: ctx.session.user.id });
    return { ok: true };
  }),

  /** 7-day grace period before hard delete — spec section 9, Settings. */
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.user.update({
      where: { id: ctx.session.user.id },
      data: { status: "DELETED" },
    });
    await ctx.db.auditLog.create({
      data: { actorId: ctx.session.user.id, action: "account.deletion_scheduled", targetType: "user", targetId: ctx.session.user.id, meta: {} },
    });
    return { ok: true, gracePeriodDays: 7 };
  }),

  cancelDeletion: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await ctx.db.user.findUniqueOrThrow({ where: { id: ctx.session.user.id } });
    if (user.status !== "DELETED") throw new TRPCError({ code: "BAD_REQUEST", message: "not_pending_deletion" });
    // The hard-delete job (data.deleteAccounts) only processes accounts
    // deleted more than 7 days ago, so flipping status back here is safe
    // within the grace period.
    await ctx.db.user.update({ where: { id: ctx.session.user.id }, data: { status: "ACTIVE" } });
    return { ok: true };
  }),
});
