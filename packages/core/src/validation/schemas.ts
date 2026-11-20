import { z } from "zod";

/** Shared between client (react-hook-form resolvers) and server (tRPC input) — spec section 3. */

export const DisplayNameSchema = z.string().trim().min(2).max(24);
export const BioSchema = z.string().trim().max(300).optional().default("");
export const PromptAnswerSchema = z.string().trim().max(150);

export const ProfileInputSchema = z.object({
  displayName: DisplayNameSchema,
  pronouns: z.string().trim().max(30).optional(),
  yearOfStudy: z.number().int().min(1).max(5),
  department: z.string().min(1),
  bio: BioSchema,
  prompts: z.array(PromptAnswerSchema).max(3),
  interests: z.array(z.string()).min(3).max(10),
  promVibe: z.string().min(1),
  heightCm: z.number().int().min(100).max(250).optional(),
});
export type ProfileInput = z.infer<typeof ProfileInputSchema>;

export const GenderSchema = z.enum(["WOMAN", "MAN", "NONBINARY", "SELF_DESCRIBE", "PREFER_NOT"]);
export const ModeSchema = z.enum(["DATE", "FRIEND", "SQUAD"]);

export const PrefsInputSchema = z.object({
  modes: z.array(ModeSchema).min(1),
  gender: GenderSchema,
  genderSelf: z.string().trim().max(40).optional(),
  seekingGenders: z.array(GenderSchema).optional().default([]),
  yearMin: z.number().int().min(1).max(5),
  yearMax: z.number().int().min(1).max(5),
  sameDeptOk: z.boolean().default(true),
  squadSizeMin: z.number().int().min(2).max(8).default(4),
  squadSizeMax: z.number().int().min(2).max(10).default(8),
  squadFriendCode: z.string().trim().length(6).optional(),
  dealbreakers: z.record(z.string(), z.array(z.union([z.string(), z.number()]))).refine(
    (d) => Object.keys(d).length <= 3,
    "At most 3 dealbreakers",
  ),
  excludedEmails: z.array(z.string().email()).max(20).default([]),
}).refine((p) => p.yearMin <= p.yearMax, { message: "yearMin must be <= yearMax", path: ["yearMin"] });
export type PrefsInput = z.infer<typeof PrefsInputSchema>;

export const AnswerInputSchema = z.object({
  questionId: z.string(),
  value: z.union([z.number().int().min(1).max(5), z.string(), z.array(z.string())]),
  importance: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
});
export type AnswerInput = z.infer<typeof AnswerInputSchema>;

export const ReportCategorySchema = z.enum([
  "harassment",
  "inappropriate_content",
  "fake_profile",
  "underage",
  "safety_concern",
  "spam",
  "other",
]);

export const ReportInputSchema = z.object({
  reportedId: z.string(),
  context: z.string(), // e.g. "match", "chat", "profile"
  contextId: z.string().optional(),
  category: ReportCategorySchema,
  details: z.string().trim().min(1).max(1000),
});
export type ReportInput = z.infer<typeof ReportInputSchema>;

export const MessageInputSchema = z.object({
  conversationId: z.string(),
  body: z.string().trim().min(1).max(1000),
});

export const EmailSchema = z.string().trim().toLowerCase().email();

/** Validates an email ends in one of the configured college domains. */
export function isAllowedCollegeEmail(email: string, allowedDomains: string[]): boolean {
  const normalised = email.trim().toLowerCase();
  const parsed = EmailSchema.safeParse(normalised);
  if (!parsed.success) return false;
  return allowedDomains.some((domain) => normalised.endsWith(`@${domain.toLowerCase()}`));
}

/**
 * Spec section 2, non-negotiable: "Adults only: every user confirms they
 * are 18 or older." Pure so it's unit-testable without a DB; the only
 * caller that matters is auth.confirmAge (apps/web/server/routers/auth.ts),
 * which — on `false` — hard-deletes the account immediately rather than
 * scheduling it, per the same principle's "and their data deleted".
 */
export function isAdult(dateOfBirth: string | Date, now: Date = new Date()): boolean {
  const birth = typeof dateOfBirth === "string" ? new Date(dateOfBirth) : dateOfBirth;
  if (Number.isNaN(birth.getTime())) return false;
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
  return age >= 18;
}
