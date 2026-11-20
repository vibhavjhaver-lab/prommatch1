import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getEventConfig } from "../../lib/config.js";
import { notify } from "../../lib/notify.js";
import { getSignedPhotoUrl } from "../../lib/storage.js";
import { canRevealIdentity } from "@prommatch/core";
import { protectedProcedure, router } from "../trpc.js";

const DecideInputSchema = z.object({
  matchId: z.string(),
  decision: z.enum(["ACCEPT", "PASS"]),
  passReason: z.enum(["different_vibe", "know_them_already", "not_my_type", "other"]).optional(),
});

/** Learning between drops (spec section 8 Step 7): nudge per-section weight multipliers. */
async function applyLearning(
  db: typeof import("@prommatch/db").prisma,
  userId: string,
  decision: "ACCEPT" | "PASS",
  reason: string | undefined,
  matchedUserAnswers: { questionId: string; value: unknown }[],
  myAnswers: { questionId: string; value: unknown }[],
  questionsById: Map<string, { section: string }>,
) {
  if (decision === "ACCEPT") return; // only passes with "different_vibe" adjust weights down; both can adjust up — simplified here to the pass path, which is what the spec calls out explicitly.
  if (reason !== "different_vibe") return;

  const prefs = await db.matchPreferences.findUnique({ where: { userId } });
  if (!prefs) return;
  const weightAdjust = { ...((prefs.weightAdjust as Record<string, number>) ?? {}) };

  const byQuestion = new Map(matchedUserAnswers.map((a) => [a.questionId, a.value]));
  const diffsBySection = new Map<string, number>();
  for (const mine of myAnswers) {
    const theirs = byQuestion.get(mine.questionId);
    const q = questionsById.get(mine.questionId);
    if (!q || theirs === undefined) continue;
    if (typeof mine.value === "number" && typeof theirs === "number") {
      const diff = Math.abs(mine.value - theirs);
      diffsBySection.set(q.section, (diffsBySection.get(q.section) ?? 0) + diff);
    }
  }

  const sorted = [...diffsBySection.entries()].sort((a, b) => b[1] - a[1]);
  const worst = sorted.slice(0, 2).map(([section]) => section);
  const best = sorted.slice(-2).map(([section]) => section);

  for (const section of worst) {
    const current = weightAdjust[section] ?? 1;
    weightAdjust[section] = Math.max(0.5, Math.min(2.0, current * 0.9));
  }
  for (const section of best) {
    const current = weightAdjust[section] ?? 1;
    weightAdjust[section] = Math.max(0.5, Math.min(2.0, current * 1.05));
  }

  await db.matchPreferences.update({ where: { userId }, data: { weightAdjust } });
}

export const matchesRouter = router({
  listProposals: protectedProcedure.input(z.object({ mode: z.enum(["DATE", "FRIEND"]) })).query(async ({ ctx, input }) => {
    const uid = ctx.session.user.id;
    const matches = await ctx.db.match.findMany({
      where: {
        mode: input.mode,
        status: "PROPOSED",
        OR: [{ userAId: uid }, { userBId: uid }],
      },
      include: { round: true },
      orderBy: { createdAt: "desc" },
    });
    return matches.map((m) => serializeProposal(m, uid));
  }),

  listMutual: protectedProcedure.input(z.object({ mode: z.enum(["DATE", "FRIEND"]) })).query(async ({ ctx, input }) => {
    const uid = ctx.session.user.id;
    const matches = await ctx.db.match.findMany({
      where: { mode: input.mode, status: "MUTUAL", OR: [{ userAId: uid }, { userBId: uid }] },
      include: { conversation: true },
      orderBy: { mutualAt: "desc" },
    });
    return matches;
  }),

  get: protectedProcedure.input(z.object({ matchId: z.string() })).query(async ({ ctx, input }) => {
    const uid = ctx.session.user.id;
    const match = await ctx.db.match.findUniqueOrThrow({ where: { id: input.matchId } });
    if (match.userAId !== uid && match.userBId !== uid) throw new TRPCError({ code: "FORBIDDEN" });
    return serializeProposal(match, uid);
  }),

  decide: protectedProcedure.input(DecideInputSchema).mutation(async ({ ctx, input }) => {
    const uid = ctx.session.user.id;
    const match = await ctx.db.match.findUniqueOrThrow({ where: { id: input.matchId }, include: { round: true } });
    if (match.userAId !== uid && match.userBId !== uid) throw new TRPCError({ code: "FORBIDDEN" });
    if (match.status !== "PROPOSED") throw new TRPCError({ code: "CONFLICT", message: "already_decided" });

    const isA = match.userAId === uid;
    const myField = isA ? "decisionA" : "decisionB";
    const otherField = isA ? "decisionB" : "decisionA";
    const decisionValue = input.decision;

    const updated = await ctx.db.match.update({
      where: { id: match.id },
      data: { [myField]: decisionValue },
    });

    const otherDecision = updated[otherField as "decisionA" | "decisionB"];
    const myDecision = updated[myField as "decisionA" | "decisionB"];

    if (myDecision === "ACCEPT" && otherDecision === "ACCEPT") {
      const conversation = await ctx.db.$transaction(async (tx) => {
        const m = await tx.match.update({
          where: { id: match.id },
          data: { status: "MUTUAL", mutualAt: new Date() },
        });
        return tx.conversation.create({ data: { matchId: m.id } });
      });

      const [profileA, profileB] = await Promise.all([
        ctx.db.profile.findUnique({ where: { userId: match.userAId } }),
        ctx.db.profile.findUnique({ where: { userId: match.userBId } }),
      ]);
      await notify({
        userId: match.userAId,
        type: "match:mutual",
        title: "It's mutual!",
        body: `Say hi to ${profileB?.displayName ?? "your match"}.`,
        link: `/chat/${conversation.id}`,
      });
      await notify({
        userId: match.userBId,
        type: "match:mutual",
        title: "It's mutual!",
        body: `Say hi to ${profileA?.displayName ?? "your match"}.`,
        link: `/chat/${conversation.id}`,
      });
    } else if (decisionValue === "PASS") {
      // Passing is never revealed to the other side (spec section 2, section 9).
      await ctx.db.pairHistory.upsert({
        where: {
          userAId_userBId_mode: {
            userAId: match.userAId,
            userBId: match.userBId,
            mode: match.mode,
          },
        },
        create: { userAId: match.userAId, userBId: match.userBId, mode: match.mode, outcome: "passed" },
        update: { outcome: "passed" },
      });

      const otherUserId = isA ? match.userBId : match.userAId;
      const [myAnswers, theirAnswers, questions] = await Promise.all([
        ctx.db.answer.findMany({ where: { userId: uid } }),
        ctx.db.answer.findMany({ where: { userId: otherUserId } }),
        ctx.db.question.findMany(),
      ]);
      const questionsById = new Map(questions.map((q) => [q.id, { section: q.section }] as const));
      await applyLearning(ctx.db, uid, "PASS", input.passReason, theirAnswers, myAnswers, questionsById);
    }

    return { ok: true, mutual: myDecision === "ACCEPT" && otherDecision === "ACCEPT" };
  }),

  unmatch: protectedProcedure.input(z.object({ matchId: z.string() })).mutation(async ({ ctx, input }) => {
    const uid = ctx.session.user.id;
    const match = await ctx.db.match.findUniqueOrThrow({ where: { id: input.matchId }, include: { conversation: true } });
    if (match.userAId !== uid && match.userBId !== uid) throw new TRPCError({ code: "FORBIDDEN" });

    await ctx.db.$transaction(async (tx) => {
      await tx.match.update({ where: { id: match.id }, data: { status: "UNMATCHED" } });
      if (match.conversation) {
        await tx.conversation.update({ where: { id: match.conversation.id }, data: { closedAt: new Date() } });
      }
    });

    const otherUserId = uid === match.userAId ? match.userBId : match.userAId;
    await notify({
      userId: otherUserId,
      type: "match:unmatched",
      title: "A match has ended",
      body: "This match has ended.",
      inAppOnly: true,
    });

    return { ok: true };
  }),

  /** Only once MUTUAL: the one place a student's full profile is revealed to a specific other student. */
  getMutualProfile: protectedProcedure.input(z.object({ matchId: z.string() })).query(async ({ ctx, input }) => {
    const uid = ctx.session.user.id;
    const match = await ctx.db.match.findUniqueOrThrow({ where: { id: input.matchId } });
    if (match.userAId !== uid && match.userBId !== uid) throw new TRPCError({ code: "FORBIDDEN" });
    if (!canRevealIdentity(match.status)) throw new TRPCError({ code: "FORBIDDEN", message: "not_mutual_yet" });

    const otherUserId = uid === match.userAId ? match.userBId : match.userAId;
    const [profile, photos] = await Promise.all([
      ctx.db.profile.findUnique({ where: { userId: otherUserId } }),
      ctx.db.photo.findMany({ where: { userId: otherUserId, status: "APPROVED" }, orderBy: { order: "asc" } }),
    ]);
    const photosWithUrls = await Promise.all(
      photos.map(async (p) => ({ ...p, signedUrl: await getSignedPhotoUrl(p.key) })),
    );

    return { otherUserId, profile, photos: photosWithUrls };
  }),
});

function serializeProposal(
  match: {
    id: string;
    userAId: string;
    userBId: string;
    score: number;
    reasons: unknown;
    decisionA: string;
    decisionB: string;
    status: string;
    round: { decisionDeadline: Date };
  },
  viewerId: string,
) {
  const isA = match.userAId === viewerId;
  const myDecision = isA ? match.decisionA : match.decisionB;
  const otherDecision = isA ? match.decisionB : match.decisionA;
  return {
    id: match.id,
    score: match.score,
    reasons: match.reasons as { text: string }[],
    myDecision,
    // Never leak the other side's actual decision to the student before mutual reveal.
    otherDecisionKnown: otherDecision === "ACCEPT" && myDecision === "ACCEPT",
    decisionDeadline: match.round.decisionDeadline,
    status: match.status,
  };
}
