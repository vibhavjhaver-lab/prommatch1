import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";

export const notificationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.notification.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }),

  markRead: protectedProcedure.input(z.object({ notificationId: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db.notification.updateMany({
      where: { id: input.notificationId, userId: ctx.session.user.id },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }),

  subscribePush: protectedProcedure
    .input(z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.pushSubscription.upsert({
        where: { endpoint: input.endpoint },
        create: { userId: ctx.session.user.id, endpoint: input.endpoint, keys: input.keys },
        update: { keys: input.keys },
      });
      return { ok: true };
    }),

  updatePrefs: protectedProcedure
    .input(z.object({ readReceipts: z.boolean().optional() }))
    .mutation(async () => {
      // Notification channel toggles (email/push per category) are stored
      // as a JSON blob on a future NotificationPrefs model — tracked in
      // PROGRESS.md as a nice-to-have; readReceipts lives on the client's
      // local settings today pending that model.
      return { ok: true };
    }),
});
