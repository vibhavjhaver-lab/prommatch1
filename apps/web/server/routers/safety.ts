import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ReportInputSchema } from "@prommatch/core";
import { protectedProcedure, router } from "../trpc.js";

const URGENT_CATEGORIES = new Set(["underage", "safety_concern"]);
const REPORTS_PER_DAY = 10;

export const safetyRouter = router({
  report: protectedProcedure.input(ReportInputSchema).mutation(async ({ ctx, input }) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todayCount = await ctx.db.report.count({ where: { reporterId: ctx.session.user.id, createdAt: { gt: since } } });
    if (todayCount >= REPORTS_PER_DAY) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "report_daily_limit" });

    const report = await ctx.db.report.create({
      data: {
        reporterId: ctx.session.user.id,
        reportedId: input.reportedId,
        context: input.context,
        contextId: input.contextId,
        category: input.category,
        details: input.details,
      },
    });

    if (URGENT_CATEGORIES.has(input.category)) {
      const organizers = await ctx.db.user.findMany({ where: { role: { in: ["ORGANIZER", "SUPERADMIN"] } } });
      const { enqueue } = await import("@prommatch/core");
      const { getEnv } = await import("../../lib/env.js");
      const env = getEnv();
      for (const org of organizers) {
        await enqueue(env.REDIS_URL, "notify.email", {
          to: org.email,
          template: "UrgentReport",
          props: { reportId: report.id, category: input.category },
        });
      }
    }

    return { ok: true, reportId: report.id };
  }),

  block: protectedProcedure
    .input(z.object({ blockedId: z.string(), reason: z.string().max(500).optional(), alsoReport: ReportInputSchema.partial().optional() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.block.upsert({
        where: { blockerId_blockedId: { blockerId: ctx.session.user.id, blockedId: input.blockedId } },
        create: { blockerId: ctx.session.user.id, blockedId: input.blockedId, reason: input.reason },
        update: {},
      });

      // Closes any open conversation between the pair (spec section 11).
      const convos = await ctx.db.conversation.findMany({
        where: {
          OR: [
            { match: { userAId: ctx.session.user.id, userBId: input.blockedId } },
            { match: { userAId: input.blockedId, userBId: ctx.session.user.id } },
          ],
        },
      });
      for (const c of convos) {
        await ctx.db.conversation.update({ where: { id: c.id }, data: { closedAt: new Date() } });
      }

      return { ok: true };
    }),

  unblock: protectedProcedure.input(z.object({ blockedId: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db.block.deleteMany({ where: { blockerId: ctx.session.user.id, blockedId: input.blockedId } });
    return { ok: true };
  }),

  listBlocked: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.block.findMany({ where: { blockerId: ctx.session.user.id } });
  }),
});
