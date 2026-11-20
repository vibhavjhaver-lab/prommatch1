import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { moderateText, isAllowed } from "@prommatch/core";
import { notify } from "../../lib/notify.js";
import { protectedProcedure, router } from "../trpc.js";

const TEMPLATES = ["starry-night", "retro-arcade", "flower-bloom", "polaroid", "scratch-card", "envelope"] as const;

export const promposalRouter = router({
  getForMatch: protectedProcedure.input(z.object({ matchId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.promposal.findUnique({ where: { matchId: input.matchId } });
  }),

  send: protectedProcedure
    .input(z.object({ matchId: z.string(), template: z.enum(TEMPLATES), message: z.string().trim().max(280) }))
    .mutation(async ({ ctx, input }) => {
      const uid = ctx.session.user.id;
      const match = await ctx.db.match.findUniqueOrThrow({ where: { id: input.matchId } });
      if (match.mode !== "DATE" || match.status !== "MUTUAL") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "promposal_requires_mutual_date_match" });
      }
      if (match.userAId !== uid && match.userBId !== uid) throw new TRPCError({ code: "FORBIDDEN" });

      const moderation = moderateText(input.message);
      if (!isAllowed(moderation)) throw new TRPCError({ code: "BAD_REQUEST", message: "message_moderation_blocked" });

      const promposal = await ctx.db.promposal.create({
        data: { matchId: match.id, fromId: uid, template: input.template, message: input.message, status: "SENT" },
      });

      const toId = uid === match.userAId ? match.userBId : match.userAId;
      const fromProfile = await ctx.db.profile.findUnique({ where: { userId: uid } });
      await notify({
        userId: toId,
        type: "promposal:received",
        title: "You've got a promposal!",
        body: `${fromProfile?.displayName ?? "Someone"} just asked you to prom.`,
        link: `/promposal/${match.id}`,
      });

      return promposal;
    }),

  respond: protectedProcedure
    .input(z.object({ matchId: z.string(), answer: z.enum(["YES", "NOT_YET"]) }))
    .mutation(async ({ ctx, input }) => {
      const promposal = await ctx.db.promposal.findUniqueOrThrow({ where: { matchId: input.matchId } });
      const match = await ctx.db.match.findUniqueOrThrow({ where: { id: input.matchId } });
      const uid = ctx.session.user.id;
      if (promposal.fromId === uid) throw new TRPCError({ code: "FORBIDDEN", message: "cannot_answer_own_promposal" });

      const updated = await ctx.db.promposal.update({
        where: { matchId: input.matchId },
        data: { status: input.answer, respondedAt: new Date() },
      });

      await notify({
        userId: promposal.fromId,
        type: "promposal:answered",
        title: input.answer === "YES" ? "They said yes! 🎉" : "They're still deciding",
        body: input.answer === "YES" ? "Your promposal was a yes!" : "Not yet — keep chatting.",
        link: `/matches/${match.id}`,
      });

      return updated;
    }),
});
