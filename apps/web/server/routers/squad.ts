import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../trpc.js";

export const squadRouter = router({
  getMine: protectedProcedure.query(async ({ ctx }) => {
    const member = await ctx.db.squadMember.findFirst({
      where: { userId: ctx.session.user.id },
      include: {
        squad: {
          include: {
            members: { include: { user: { include: { profile: true } } } },
            conversation: true,
          },
        },
      },
      orderBy: { id: "desc" },
    });
    if (!member) return null;

    const acceptedCount = member.squad.members.filter((m) => m.decision === "ACCEPT").length;
    return {
      id: member.squad.id,
      name: member.squad.name,
      status: member.squad.status,
      myDecision: member.decision,
      conversationId: acceptedCount >= 3 ? member.squad.conversation?.id : undefined,
      members: member.squad.members.map((m) => ({
        userId: m.userId,
        decision: m.decision,
        // A member's name reveals to the squad only once they've accepted (spec section 9).
        displayName: m.decision === "ACCEPT" ? m.user.profile?.displayName ?? "Member" : "Someone",
        revealed: m.decision === "ACCEPT",
      })),
    };
  }),

  decide: protectedProcedure
    .input(z.object({ squadId: z.string(), decision: z.enum(["ACCEPT", "PASS"]) }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.squadMember.findUnique({
        where: { squadId_userId: { squadId: input.squadId, userId: ctx.session.user.id } },
      });
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });

      await ctx.db.squadMember.update({ where: { id: member.id }, data: { decision: input.decision } });

      const acceptedCount = await ctx.db.squadMember.count({ where: { squadId: input.squadId, decision: "ACCEPT" } });
      if (acceptedCount === 3) {
        const existing = await ctx.db.conversation.findUnique({ where: { squadId: input.squadId } });
        if (!existing) await ctx.db.conversation.create({ data: { squadId: input.squadId } });
      }

      return { ok: true };
    }),

  leave: protectedProcedure.input(z.object({ squadId: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db.squadMember.deleteMany({ where: { squadId: input.squadId, userId: ctx.session.user.id } });
    const remaining = await ctx.db.squadMember.count({ where: { squadId: input.squadId } });
    if (remaining < 3) {
      // Below offering a group chat; leave squad row as-is for the next
      // drop's top-up pass (packages/matcher squad pre-clustering reads
      // existing members as a seed in a future enhancement — tracked in
      // PROGRESS.md).
    }
    return { ok: true };
  }),
});
