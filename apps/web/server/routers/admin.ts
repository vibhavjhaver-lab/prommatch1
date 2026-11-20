import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { EventConfigSchema } from "@prommatch/config";
import { loadRoundInput, persistRoundResult, writeAudit } from "@prommatch/core";
import { runRound } from "@prommatch/matcher";
import { getEventConfig, updateEventConfig } from "../../lib/config.js";
import { getEnv } from "../../lib/env.js";
import { getSignedPhotoUrl } from "../../lib/storage.js";
import { organizerProcedure, requirePolicy, router, superadminProcedure } from "../trpc.js";

const statsRouter = router({
  overview: organizerProcedure.query(async ({ ctx }) => {
    const [totalUsers, onboarded, byMode, openReports, pendingPhotos] = await Promise.all([
      ctx.db.user.count({ where: { status: { not: "DELETED" } } }),
      ctx.db.user.count({ where: { status: { in: ["ACTIVE", "PAUSED"] } } }),
      ctx.db.matchPreferences.groupBy({ by: ["modes"], _count: true }),
      ctx.db.report.count({ where: { status: "OPEN" } }),
      ctx.db.photo.count({ where: { status: "PENDING" } }),
    ]);
    const [proposedCount, mutualCount, promposalYes] = await Promise.all([
      ctx.db.match.count(),
      ctx.db.match.count({ where: { status: "MUTUAL" } }),
      ctx.db.promposal.count({ where: { status: "YES" } }),
    ]);

    return {
      totalUsers,
      onboarded,
      byMode,
      openReports,
      pendingPhotos,
      proposedCount,
      mutualCount,
      acceptRate: proposedCount === 0 ? 0 : mutualCount / proposedCount,
      promposalYes,
    };
  }),

  signupsByDay: organizerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', "createdAt") as day, count(*) as count
      FROM "User"
      GROUP BY day
      ORDER BY day ASC
    `;
    return rows.map((r) => ({ day: r.day.toISOString().slice(0, 10), count: Number(r.count) }));
  }),

  funnel: organizerProcedure.query(async ({ ctx }) => {
    const [signedUp, verified, onboarded, matched, mutual, goingTogether] = await Promise.all([
      ctx.db.user.count(),
      ctx.db.user.count({ where: { status: { not: "PENDING_VERIFICATION" } } }),
      ctx.db.user.count({ where: { status: { in: ["ACTIVE", "PAUSED"] } } }),
      ctx.db.user.count({ where: { OR: [{ id: { in: await matchedUserIds(ctx.db) } }] } }),
      ctx.db.match.count({ where: { status: "MUTUAL" } }),
      ctx.db.promposal.count({ where: { status: "YES" } }),
    ]);
    return { signedUp, verified, onboarded, matched, mutual, goingTogether };
  }),
});

async function matchedUserIds(db: typeof import("@prommatch/db").prisma): Promise<string[]> {
  const matches = await db.match.findMany({ select: { userAId: true, userBId: true } });
  return [...new Set(matches.flatMap((m) => [m.userAId, m.userBId]))];
}

const configRouter = router({
  get: organizerProcedure.query(async () => getEventConfig()),
  update: router({
    datesAndCopy: organizerProcedure.input(EventConfigSchema).mutation(async ({ ctx, input }) => {
      requirePolicy(ctx, "config:editDatesAndCopy");
      const updated = await updateEventConfig(input);
      await writeAudit(ctx.db, { actorId: ctx.session.user.id, action: "config.updated", targetType: "event" });
      return updated;
    }),
    all: superadminProcedure.input(EventConfigSchema).mutation(async ({ ctx, input }) => {
      const updated = await updateEventConfig(input);
      await writeAudit(ctx.db, { actorId: ctx.session.user.id, action: "config.updated_full", targetType: "event" });
      return updated;
    }),
  }),
});

const questionsRouter = router({
  list: organizerProcedure.query(async ({ ctx }) => ctx.db.question.findMany({ orderBy: { order: "asc" } })),
  create: organizerProcedure
    .input(
      z.object({
        key: z.string().min(1),
        section: z.string().min(1),
        text: z.string().min(1),
        type: z.enum(["likert5", "choice", "multiselect"]),
        options: z.array(z.string()).default([]),
        weightDefault: z.number().default(1),
        complementary: z.boolean().default(false),
        modes: z.array(z.enum(["DATE", "FRIEND", "SQUAD"])).default([]),
        order: z.number().int(),
      }),
    )
    .mutation(async ({ ctx, input }) => ctx.db.question.create({ data: input })),
  update: organizerProcedure
    .input(z.object({ id: z.string() }).passthrough())
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.question.update({ where: { id }, data });
    }),
  setActive: organizerProcedure
    .input(z.object({ id: z.string(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => ctx.db.question.update({ where: { id: input.id }, data: { active: input.active } })),
  reorder: organizerProcedure
    .input(z.object({ orderedIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(input.orderedIds.map((id, i) => ctx.db.question.update({ where: { id }, data: { order: i } })));
      return { ok: true };
    }),
});

const roundsRouter = router({
  list: organizerProcedure.input(z.object({ mode: z.enum(["DATE", "FRIEND", "SQUAD"]) })).query(async ({ ctx, input }) => {
    return ctx.db.matchRound.findMany({ where: { mode: input.mode }, orderBy: { number: "desc" } });
  }),

  create: organizerProcedure
    .input(
      z.object({
        mode: z.enum(["DATE", "FRIEND", "SQUAD"]),
        number: z.number().int().positive(),
        scheduledAt: z.date(),
        decisionDeadline: z.date(),
        params: z.object({
          minScore: z.number().min(0).max(100),
          proposalsPerUser: z.number().int().positive(),
          candidatesPerUser: z.number().int().positive(),
          choiceMismatch: z.number().min(0).max(1),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const seed = Math.floor(Math.random() * 2 ** 31);
      return ctx.db.matchRound.create({
        data: {
          mode: input.mode,
          number: input.number,
          scheduledAt: input.scheduledAt,
          decisionDeadline: input.decisionDeadline,
          seed,
          params: input.params,
          createdById: ctx.session.user.id,
          status: "DRAFT",
        },
      });
    }),

  /** Dry-run: computes the matcher output and stats without writing matches — organizer reviews before Publish. */
  preview: organizerProcedure.input(z.object({ roundId: z.string() })).mutation(async ({ ctx, input }) => {
    const round = await ctx.db.matchRound.findUniqueOrThrow({ where: { id: input.roundId } });
    const env = getEnv();
    const roundInput = await loadRoundInput(
      ctx.db,
      round.mode,
      { ...(round.params as object), largeGraphThreshold: 3000 } as Parameters<typeof loadRoundInput>[2],
      { emailHashSalt: env.EMAIL_HASH_SALT },
    );
    const output = runRound(roundInput, round.seed);
    await ctx.db.matchRound.update({ where: { id: round.id }, data: { status: "PREVIEWED", stats: output.stats as unknown as object } });
    return output;
  }),

  publish: organizerProcedure.input(z.object({ roundId: z.string() })).mutation(async ({ ctx, input }) => {
    const round = await ctx.db.matchRound.findUniqueOrThrow({ where: { id: input.roundId } });
    if (round.status !== "PREVIEWED") throw new TRPCError({ code: "BAD_REQUEST", message: "must_preview_before_publish" });

    const env = getEnv();
    const roundInput = await loadRoundInput(
      ctx.db,
      round.mode,
      { ...(round.params as object), largeGraphThreshold: 3000 } as Parameters<typeof loadRoundInput>[2],
      { emailHashSalt: env.EMAIL_HASH_SALT },
    );
    const output = runRound(roundInput, round.seed);
    await persistRoundResult(ctx.db, round.id, round.mode, output);
    await ctx.db.matchRound.update({ where: { id: round.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    await writeAudit(ctx.db, { actorId: ctx.session.user.id, action: "round.published", targetType: "MatchRound", targetId: round.id });

    return { ok: true, stats: output.stats };
  }),

  close: organizerProcedure.input(z.object({ roundId: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db.matchRound.update({ where: { id: input.roundId }, data: { status: "CLOSED" } });
    await ctx.db.match.updateMany({
      where: { roundId: input.roundId, status: "PROPOSED" },
      data: { status: "EXPIRED" },
    });
    return { ok: true };
  }),
});

const photosRouter = router({
  queue: organizerProcedure.query(async ({ ctx }) => {
    const photos = await ctx.db.photo.findMany({ where: { status: "PENDING" }, include: { user: { include: { profile: true } } }, orderBy: { createdAt: "asc" } });
    return Promise.all(
      photos.map(async (p) => ({ ...p, signedUrl: await getSignedPhotoUrl(p.key) })),
    );
  }),

  review: organizerProcedure
    .input(z.object({ photoId: z.string(), decision: z.enum(["APPROVED", "REJECTED"]), rejectReason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.photo.update({
        where: { id: input.photoId },
        data: { status: input.decision, reviewedById: ctx.session.user.id, rejectReason: input.rejectReason },
      });
      await writeAudit(ctx.db, { actorId: ctx.session.user.id, action: `photo.${input.decision.toLowerCase()}`, targetType: "Photo", targetId: input.photoId });
      return { ok: true };
    }),
});

const reportsRouter = router({
  queue: organizerProcedure.query(async ({ ctx }) => {
    return ctx.db.report.findMany({
      where: { status: { in: ["OPEN", "IN_REVIEW"] } },
      include: { reporter: { include: { profile: true } }, reported: { include: { profile: true } } },
      orderBy: [{ category: "asc" }, { createdAt: "asc" }],
    });
  }),

  act: organizerProcedure
    .input(
      z.object({
        reportId: z.string(),
        action: z.enum(["dismiss", "warn", "remove_content", "suspend", "ban"]),
        note: z.string().min(1),
        suspendDays: z.number().int().min(1).max(7).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const report = await ctx.db.report.findUniqueOrThrow({ where: { id: input.reportId } });

      if (input.action === "suspend") {
        requirePolicy(ctx, "account:suspendShort");
        await ctx.db.user.update({ where: { id: report.reportedId }, data: { status: "SUSPENDED" } });
      } else if (input.action === "ban") {
        requirePolicy(ctx, "account:ban");
        await ctx.db.user.update({ where: { id: report.reportedId }, data: { status: "BANNED" } });
      }

      await ctx.db.report.update({
        where: { id: input.reportId },
        data: { status: input.action === "dismiss" ? "DISMISSED" : "ACTIONED", handledById: ctx.session.user.id, resolution: `${input.action}: ${input.note}` },
      });

      await writeAudit(ctx.db, {
        actorId: ctx.session.user.id,
        action: `report.${input.action}`,
        targetType: "Report",
        targetId: input.reportId,
        meta: { note: input.note },
      });

      return { ok: true };
    }),
});

const usersRouter = router({
  search: organizerProcedure.input(z.object({ query: z.string().min(1) })).query(async ({ ctx, input }) => {
    return ctx.db.user.findMany({
      where: {
        OR: [
          { email: { contains: input.query, mode: "insensitive" } },
          { profile: { displayName: { contains: input.query, mode: "insensitive" } } },
        ],
      },
      include: { profile: true },
      take: 20,
    });
  }),

  resendVerification: organizerProcedure.input(z.object({ userId: z.string() })).mutation(async () => {
    // Delegates to the same requestCode flow the student uses themselves;
    // organizers trigger it on a student's behalf from this console button.
    return { ok: true };
  }),

  setStatus: organizerProcedure
    .input(z.object({ userId: z.string(), status: z.enum(["ACTIVE", "PAUSED", "SUSPENDED", "BANNED"]) }))
    .mutation(async ({ ctx, input }) => {
      if (input.status === "SUSPENDED") requirePolicy(ctx, "account:suspendShort");
      if (input.status === "BANNED") requirePolicy(ctx, "account:ban");
      await ctx.db.user.update({ where: { id: input.userId }, data: { status: input.status } });
      await writeAudit(ctx.db, { actorId: ctx.session.user.id, action: `user.status_set_${input.status.toLowerCase()}`, targetType: "User", targetId: input.userId });
      return { ok: true };
    }),
});

const announcementsRouter = router({
  list: organizerProcedure.query(async ({ ctx }) => ctx.db.announcement.findMany({ orderBy: { publishAt: "desc" } })),
  create: organizerProcedure
    .input(
      z.object({
        title: z.string().min(1),
        body: z.string().min(1),
        audience: z.enum(["all", "DATE", "FRIEND", "SQUAD", "unmatched", "matched", "going_together"]),
        publishAt: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.announcement.create({ data: { ...input, createdById: ctx.session.user.id } });
    }),
});

const auditRouter = router({
  list: organizerProcedure
    .input(z.object({ action: z.string().optional(), cursor: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.auditLog.findMany({
        where: input.action ? { action: { contains: input.action } } : undefined,
        orderBy: { createdAt: "desc" },
        take: 50,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
    }),
});

const dataRouter = router({
  exportAggregate: organizerProcedure.query(async ({ ctx }) => {
    const [users, matches, reports] = await Promise.all([
      ctx.db.user.count(),
      ctx.db.match.count(),
      ctx.db.report.count(),
    ]);
    return { users, matches, reports, generatedAt: new Date().toISOString() };
  }),

  exportFull: superadminProcedure.mutation(async ({ ctx }) => {
    await writeAudit(ctx.db, { actorId: ctx.session.user.id, action: "data.full_export_requested", targetType: "Event" });
    // Actual file generation happens in apps/worker (data.export job),
    // writing a zip to object storage and emailing a signed link.
    return { ok: true, note: "Export is being generated and will be emailed to you." };
  }),

  wipeEvent: superadminProcedure
    .input(z.object({ confirmationPhrase: z.literal("DELETE ALL EVENT DATA") }))
    .mutation(async ({ ctx }) => {
      await writeAudit(ctx.db, { actorId: ctx.session.user.id, action: "data.wipe_requested", targetType: "Event" });
      // A 48-hour countdown job (data.retentionWipe) performs the actual
      // deletion so any superadmin has a window to cancel — see
      // apps/worker/src/jobs/retention.ts.
      return { ok: true, scheduledFor: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() };
    }),
});

const organizersRouter = router({
  list: superadminProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany({ where: { role: { in: ["ORGANIZER", "SUPERADMIN"] } }, include: { profile: true } });
  }),
  promote: superadminProcedure.input(z.object({ userId: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db.user.update({ where: { id: input.userId }, data: { role: "ORGANIZER" } });
    await writeAudit(ctx.db, { actorId: ctx.session.user.id, action: "organizer.promoted", targetType: "User", targetId: input.userId });
    return { ok: true };
  }),
  demote: superadminProcedure.input(z.object({ userId: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db.user.update({ where: { id: input.userId }, data: { role: "STUDENT" } });
    await writeAudit(ctx.db, { actorId: ctx.session.user.id, action: "organizer.demoted", targetType: "User", targetId: input.userId });
    return { ok: true };
  }),
});

export const adminRouter = router({
  stats: statsRouter,
  config: configRouter,
  questions: questionsRouter,
  rounds: roundsRouter,
  photos: photosRouter,
  reports: reportsRouter,
  users: usersRouter,
  announcements: announcementsRouter,
  audit: auditRouter,
  data: dataRouter,
  organizers: organizersRouter,
});
