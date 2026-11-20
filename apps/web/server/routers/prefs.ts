import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { PrefsInputSchema, hashForComparison } from "@prommatch/core";
import { getEnv } from "../../lib/env.js";
import { protectedProcedure, router } from "../trpc.js";

function generateFriendCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export const prefsRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.matchPreferences.findUnique({ where: { userId: ctx.session.user.id } });
  }),

  update: protectedProcedure.input(PrefsInputSchema).mutation(async ({ ctx, input }) => {
    const salt = getEnv().EMAIL_HASH_SALT;
    const excludedEmailHashes = input.excludedEmails.map((e) => hashForComparison(e, salt));

    return ctx.db.matchPreferences.upsert({
      where: { userId: ctx.session.user.id },
      create: {
        userId: ctx.session.user.id,
        modes: input.modes,
        gender: input.gender,
        genderSelf: input.genderSelf,
        seekingGenders: input.seekingGenders,
        yearMin: input.yearMin,
        yearMax: input.yearMax,
        sameDeptOk: input.sameDeptOk,
        squadSizeMin: input.squadSizeMin,
        squadSizeMax: input.squadSizeMax,
        squadFriendCode: input.squadFriendCode,
        dealbreakers: input.dealbreakers,
        excludedEmails: excludedEmailHashes,
      },
      update: {
        modes: input.modes,
        gender: input.gender,
        genderSelf: input.genderSelf,
        seekingGenders: input.seekingGenders,
        yearMin: input.yearMin,
        yearMax: input.yearMax,
        sameDeptOk: input.sameDeptOk,
        squadSizeMin: input.squadSizeMin,
        squadSizeMax: input.squadSizeMax,
        dealbreakers: input.dealbreakers,
        excludedEmails: excludedEmailHashes,
      },
    });
  }),

  setExcludedEmails: protectedProcedure
    .input(z.object({ emails: z.array(z.string().email()).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const salt = getEnv().EMAIL_HASH_SALT;
      const hashes = input.emails.map((e) => hashForComparison(e, salt));
      await ctx.db.matchPreferences.update({ where: { userId: ctx.session.user.id }, data: { excludedEmails: hashes } });
      return { ok: true };
    }),

  pause: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.matchPreferences.update({ where: { userId: ctx.session.user.id }, data: { paused: true } });
    return { ok: true };
  }),

  resume: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.matchPreferences.update({ where: { userId: ctx.session.user.id }, data: { paused: false } });
    return { ok: true };
  }),

  createFriendCode: protectedProcedure.mutation(async ({ ctx }) => {
    let code = generateFriendCode();
    // Extremely unlikely to collide given the alphabet size, but guard anyway.
    for (let i = 0; i < 5; i++) {
      const existing = await ctx.db.matchPreferences.findFirst({ where: { squadFriendCode: code } });
      if (!existing) break;
      code = generateFriendCode();
    }
    await ctx.db.matchPreferences.update({ where: { userId: ctx.session.user.id }, data: { squadFriendCode: code } });
    return { code };
  }),

  joinFriendCode: protectedProcedure.input(z.object({ code: z.string().length(6) })).mutation(async ({ ctx, input }) => {
    const holders = await ctx.db.matchPreferences.count({ where: { squadFriendCode: input.code.toUpperCase() } });
    if (holders === 0) throw new TRPCError({ code: "NOT_FOUND", message: "invalid_friend_code" });
    if (holders >= 4) throw new TRPCError({ code: "BAD_REQUEST", message: "friend_code_full" });
    await ctx.db.matchPreferences.update({
      where: { userId: ctx.session.user.id },
      data: { squadFriendCode: input.code.toUpperCase() },
    });
    return { ok: true };
  }),
});
