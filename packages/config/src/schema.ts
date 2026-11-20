import { z } from "zod";

/**
 * EventConfig is the single source of truth for everything that differs
 * per college: names, dates, venue, colours, feature flags. Never hard-code
 * these values anywhere else in the codebase — import from this package,
 * or read the runtime-editable copy from the EventConfig database table
 * (which the admin console writes to; see packages/core/config-store.ts).
 */

export const ModeSchema = z.enum(["DATE", "FRIEND", "SQUAD"]);
export type ModeKey = z.infer<typeof ModeSchema>;

export const ScheduleItemSchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/, "time must be HH:mm"),
  item: z.string().min(1),
});

export const EmergencyContactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
});

export const DatesSchema = z
  .object({
    questionnaireOpensAt: z.string(),
    questionnaireClosesAt: z.string(),
    /** ISO datetimes, one per scheduled match round. First entry is Drop 1. */
    drops: z.array(z.string()).min(1),
    decisionWindowHours: z.number().int().positive().default(72),
    promStartsAt: z.string(),
    promEndsAt: z.string(),
    chatRetentionDaysAfterProm: z.number().int().positive().default(14),
    dataRetentionDaysAfterProm: z.number().int().positive().default(30),
  })
  .superRefine((dates, ctx) => {
    const open = Date.parse(dates.questionnaireOpensAt);
    const close = Date.parse(dates.questionnaireClosesAt);
    const promStart = Date.parse(dates.promStartsAt);
    const promEnd = Date.parse(dates.promEndsAt);
    const dropTimes = dates.drops.map((d) => Date.parse(d));

    if (open >= close) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "questionnaireOpensAt must be before questionnaireClosesAt",
        path: ["questionnaireOpensAt"],
      });
    }
    if (promStart >= promEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "promStartsAt must be before promEndsAt",
        path: ["promStartsAt"],
      });
    }
    dropTimes.forEach((t, i) => {
      if (t < close) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `drops[${i}] must be on or after questionnaireClosesAt`,
          path: ["drops", i],
        });
      }
      if (t > promStart) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `drops[${i}] must be before promStartsAt`,
          path: ["drops", i],
        });
      }
      if (i > 0) {
        const prev = dropTimes[i - 1];
        if (prev !== undefined && t <= prev) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `drops[${i}] must be after drops[${i - 1}]`,
            path: ["drops", i],
          });
        }
      }
    });
  });

export const MatchingParamsSchema = z.object({
  minScore: z.number().min(0).max(100).default(55),
  proposalsPerUser: z.number().int().positive().default(3),
  candidatesPerUser: z.number().int().positive().default(40),
  choiceMismatch: z.number().min(0).max(1).default(0.2),
  autoPublishRounds: z.boolean().default(false),
});

export const FeatureFlagsSchema = z.object({
  revealPhotosBeforeAccept: z.boolean().default(false),
  chatImages: z.boolean().default(false),
  readReceiptsDefault: z.boolean().default(true),
});

export const EventConfigSchema = z.object({
  collegeName: z.string().min(1),
  eventName: z.string().min(1),
  appName: z.string().min(1).default("PromMatch"),
  allowedEmailDomains: z.array(z.string().min(1)).min(1),
  superAdmins: z.array(z.string().email()).min(1),
  timeZone: z.string().min(1),
  venue: z.object({
    name: z.string().min(1),
    address: z.string().min(1),
    mapImage: z.string().nullable(),
  }),
  dates: DatesSchema,
  modes: z.object({
    DATE: z.boolean(),
    FRIEND: z.boolean(),
    SQUAD: z.boolean(),
  }),
  departments: z.array(z.string().min(1)).min(1),
  years: z.array(z.number().int().positive()).min(1),
  promVibes: z.array(z.string().min(1)).min(1),
  interests: z.array(z.string().min(1)).min(1),
  prompts: z.array(z.string().min(1)).min(1),
  matching: MatchingParamsSchema,
  flags: FeatureFlagsSchema,
  schedule: z.array(ScheduleItemSchema),
  emergencyContacts: z.array(EmergencyContactSchema).min(1),
  counsellingLink: z.string().url(),
  theme: z.object({
    mode: z.enum(["dark", "light"]).default("dark"),
    overrides: z.record(z.string(), z.string()).default({}),
  }),
});

export type EventConfig = z.infer<typeof EventConfigSchema>;
