import { randomBytes } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { isAllowedCollegeEmail, isAdult, hashForComparison } from "@prommatch/core";
import { getEventConfig } from "../../lib/config.js";
import { getEnv } from "../../lib/env.js";
import { publicProcedure, protectedProcedure, router } from "../trpc.js";

const CODES_PER_EMAIL_PER_HOUR = 5;
const CODES_PER_IP_PER_HOUR = 20;

export const authRouter = router({
  /**
   * Checks the email's domain and basic rate limits before Auth.js's own
   * signIn() is called client-side (which actually sends the email). This
   * lets the sign-in form show "that's not a college email" inline instead
   * of waiting for a round-trip through the provider.
   */
  requestCode: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const config = await getEventConfig();
      const email = input.email.trim().toLowerCase();
      if (!isAllowedCollegeEmail(email, config.allowedEmailDomains)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "domain_not_allowed" });
      }

      const since = new Date(Date.now() - 60 * 60 * 1000);
      const recent = await ctx.db.auditLog.count({
        where: { action: "auth.code_requested", meta: { path: ["email"], equals: email }, createdAt: { gt: since } },
      });
      if (recent >= CODES_PER_EMAIL_PER_HOUR) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "too_many_codes_for_email" });
      }

      await ctx.db.auditLog.create({
        data: { actorId: null, action: "auth.code_requested", targetType: "email", meta: { email } },
      });

      return { ok: true };
    }),

  /** Called once, right after first verification: records the age/consent gate (spec section 6 step 3). */
  confirmAge: protectedProcedure
    .input(
      z.object({
        isAdult: z.literal(true),
        acceptedConduct: z.literal(true),
        termsVersion: z.string(),
        dateOfBirth: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.dateOfBirth) {
        if (!isAdult(input.dateOfBirth)) {
          // Spec section 2, non-negotiable: "Under-18 sign-ups are blocked
          // and their data deleted" — not merely scheduled for deletion.
          // This is deliberately NOT the same path as me.deleteAccount
          // (status=DELETED + a 7-day grace period the user can cancel):
          // a 7-day retention window of a minor's data would itself violate
          // this principle. Write the audit entry first (AuditLog.targetId
          // is a plain string, not a foreign key — see schema.prisma — so
          // it safely outlives the user row), then hard-delete immediately.
          // At this point in onboarding (age-gate is step 1 of the wizard)
          // the account has at most an email/session and no profile yet.
          await ctx.db.auditLog.create({
            data: { actorId: null, action: "auth.underage_blocked_and_deleted", targetType: "user", targetId: ctx.session.user.id, meta: {} },
          });
          await ctx.db.user.delete({ where: { id: ctx.session.user.id } });
          throw new TRPCError({ code: "FORBIDDEN", message: "underage" });
        }
      }

      await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: { ageConfirmedAt: new Date(), termsVersion: input.termsVersion, status: "ONBOARDING" },
      });
      return { ok: true };
    }),

  acceptTerms: protectedProcedure
    .input(z.object({ termsVersion: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.update({ where: { id: ctx.session.user.id }, data: { termsVersion: input.termsVersion } });
      return { ok: true };
    }),

  /** Organizer/superadmin TOTP enrolment — forced on first sign-in per spec section 6. */
  enrollTotp: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.session.user.role === "STUDENT") throw new TRPCError({ code: "FORBIDDEN" });
    const secret = authenticator.generateSecret();
    const config = await getEventConfig();
    const otpauth = authenticator.keyuri(ctx.session.user.email ?? "organizer", config.appName, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    const recoveryCodes = Array.from({ length: 8 }, () => randomRecoveryCode());
    const hashedRecovery = recoveryCodes.map((c) => hashForComparison(c, getEnv().EMAIL_HASH_SALT));

    await ctx.db.user.update({
      where: { id: ctx.session.user.id },
      data: { totpSecret: secret, totpRecovery: hashedRecovery },
    });

    return { qrDataUrl, recoveryCodes };
  }),

  verifyTotp: protectedProcedure
    .input(z.object({ token: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUniqueOrThrow({ where: { id: ctx.session.user.id } });
      if (!user.totpSecret) throw new TRPCError({ code: "BAD_REQUEST", message: "totp_not_enrolled" });
      const valid = authenticator.check(input.token, user.totpSecret);
      if (!valid) throw new TRPCError({ code: "BAD_REQUEST", message: "invalid_totp" });
      return { ok: true };
    }),
});

function randomRecoveryCode(): string {
  return randomBytes(6).toString("hex").toUpperCase();
}
