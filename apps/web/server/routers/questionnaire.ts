import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { AnswerInputSchema } from "@prommatch/core";
import { getEventConfig } from "../../lib/config.js";
import { protectedProcedure, router } from "../trpc.js";

export const questionnaireRouter = router({
  getQuestions: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUniqueOrThrow({ where: { id: ctx.session.user.id }, include: { prefs: true } });
    const modes = user.prefs?.modes ?? [];
    const all = await ctx.db.question.findMany({ where: { active: true }, orderBy: { order: "asc" } });
    // Date-only questions hidden for students who didn't pick Date mode (spec section 7).
    return all.filter((q) => q.modes.length === 0 || q.modes.some((m) => modes.includes(m)));
  }),

  getMyAnswers: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.answer.findMany({ where: { userId: ctx.session.user.id } });
  }),

  saveAnswer: protectedProcedure.input(AnswerInputSchema).mutation(async ({ ctx, input }) => {
    const config = await getEventConfig();
    if (Date.now() > Date.parse(config.dates.questionnaireClosesAt)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "questionnaire_closed" });
    }
    return ctx.db.answer.upsert({
      where: { userId_questionId: { userId: ctx.session.user.id, questionId: input.questionId } },
      create: { userId: ctx.session.user.id, questionId: input.questionId, value: input.value, importance: input.importance },
      update: { value: input.value, importance: input.importance },
    });
  }),

  setDealbreakers: protectedProcedure
    .input(z.object({ dealbreakers: z.record(z.string(), z.array(z.union([z.string(), z.number()]))) }))
    .mutation(async ({ ctx, input }) => {
      if (Object.keys(input.dealbreakers).length > 3) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "max_3_dealbreakers" });
      }
      return ctx.db.matchPreferences.update({
        where: { userId: ctx.session.user.id },
        data: { dealbreakers: input.dealbreakers },
      });
    }),

  /** Powers the onboarding progress bar and the dashboard "answer N more" card. */
  progress: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUniqueOrThrow({ where: { id: ctx.session.user.id }, include: { prefs: true } });
    const modes = user.prefs?.modes ?? [];
    const questions = await ctx.db.question.findMany({ where: { active: true } });
    const applicable = questions.filter((q) => q.modes.length === 0 || q.modes.some((m) => modes.includes(m)));
    const answered = await ctx.db.answer.count({ where: { userId: ctx.session.user.id } });
    return { total: applicable.length, answered, complete: answered >= applicable.length };
  }),
});
