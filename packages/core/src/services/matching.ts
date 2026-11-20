import type { Prisma, PrismaClient } from "@prommatch/db";
import {
  runRound,
  type ModeKey,
  type ProposedPair,
  type ProposedSquad,
  type QuestionDef,
  type RoundInput,
  type RoundOutput,
  type UserSnapshot,
} from "@prommatch/matcher";
import { hashForComparison } from "../crypto/crypto.js";

export interface MatchingSecrets {
  emailHashSalt: string;
}

const ELIGIBLE_STATUSES = ["ACTIVE"] as const;

/**
 * Loads everything the matcher needs for one round and maps it into the
 * matcher package's plain types. This is the only place Prisma rows ever
 * touch the matcher — packages/matcher itself never imports Prisma.
 */
export async function loadRoundInput(
  db: PrismaClient,
  mode: ModeKey,
  params: RoundInput["params"],
  secrets: MatchingSecrets,
): Promise<RoundInput> {
  const [users, questions, blocks, history] = await Promise.all([
    db.user.findMany({
      where: { status: { in: [...ELIGIBLE_STATUSES] } },
      include: { profile: true, prefs: true, answers: true },
    }),
    db.question.findMany({ where: { active: true } }),
    db.block.findMany(),
    db.pairHistory.findMany({ where: { mode } }),
  ]);

  const questionDefs: QuestionDef[] = questions.map((q) => ({
    id: q.id,
    key: q.key,
    section: q.section,
    type: q.type as QuestionDef["type"],
    scoring: q.complementary ? "complementary" : inferScoring(q.type as QuestionDef["type"]),
    weightDefault: q.weightDefault,
    modes: q.modes.length ? (q.modes as ModeKey[]) : null,
  }));

  // Pull open (undecided) proposal counts per user per mode so eligibility
  // can respect the proposalsPerUser cap (spec section 8 Step 1).
  const openMatches = await db.match.findMany({
    where: {
      mode: mode === "SQUAD" ? undefined : (mode as "DATE" | "FRIEND"),
      OR: [{ decisionA: "PENDING" }, { decisionB: "PENDING" }],
    },
    select: { userAId: true, userBId: true, mode: true },
  });
  const openCountByUser = new Map<string, Record<ModeKey, number>>();
  const bump = (userId: string, m: ModeKey) => {
    const rec = openCountByUser.get(userId) ?? { DATE: 0, FRIEND: 0, SQUAD: 0 };
    rec[m] += 1;
    openCountByUser.set(userId, rec);
  };
  for (const m of openMatches) {
    bump(m.userAId, m.mode as ModeKey);
    bump(m.userBId, m.mode as ModeKey);
  }

  const snapshots: UserSnapshot[] = [];
  for (const u of users) {
    if (!u.profile || !u.prefs) continue; // onboarding incomplete

    const ownEmailHash = hashForComparison(u.email, secrets.emailHashSalt);
    const dealbreakerQuestionIds = u.prefs.dealbreakers as Record<string, (string | number)[]>;

    snapshots.push({
      id: u.id,
      yearOfStudy: u.profile.yearOfStudy,
      department: u.profile.department,
      interests: u.profile.interests,
      promVibe: u.profile.promVibe,
      gender: u.prefs.gender,
      seekingGenders: u.prefs.seekingGenders,
      yearMin: u.prefs.yearMin,
      yearMax: u.prefs.yearMax,
      sameDeptOk: u.prefs.sameDeptOk,
      modes: u.prefs.modes as ModeKey[],
      squadSizeMin: u.prefs.squadSizeMin,
      squadSizeMax: u.prefs.squadSizeMax,
      squadFriendCode: u.prefs.squadFriendCode,
      dealbreakers: dealbreakerQuestionIds ?? {},
      excludedEmailHashes: u.prefs.excludedEmails,
      ownEmailHash,
      answers: u.answers.map((a) => ({
        questionId: a.questionId,
        value: a.value as number | string | string[],
        importance: a.importance as 0 | 1 | 2 | 3,
      })),
      weightAdjust: (u.prefs.weightAdjust as Record<string, number>) ?? {},
      openProposalCount: openCountByUser.get(u.id) ?? { DATE: 0, FRIEND: 0, SQUAD: 0 },
      eligible: !u.prefs.paused,
    });
  }

  return {
    mode,
    users: snapshots,
    questions: questionDefs,
    blocks: blocks.map((b) => ({ a: b.blockerId, b: b.blockedId })),
    history: history.map((h) => ({ a: h.userAId, b: h.userBId, mode: h.mode as ModeKey })),
    params,
  };
}

function inferScoring(type: QuestionDef["type"]): QuestionDef["scoring"] {
  if (type === "choice") return "choiceExact";
  if (type === "multiselect") return "jaccard";
  return "similarity";
}

export interface PersistedRoundResult {
  matchIds: string[];
  squadIds: string[];
}

/**
 * Writes a round's matcher output to the database: Match rows (sorted so
 * userAId < userBId per the schema's documented invariant), Squad +
 * SquadMember rows, and PairHistory entries so these pairs are never
 * re-proposed. Updates MatchRound.stats and leaves status as PREVIEWED —
 * the caller (admin "Publish" action) flips it to PUBLISHED.
 */
export async function persistRoundResult(
  db: PrismaClient,
  roundId: string,
  mode: ModeKey,
  output: RoundOutput,
): Promise<PersistedRoundResult> {
  return db.$transaction(async (tx) => {
    const matchIds: string[] = [];
    const squadIds: string[] = [];

    if (mode !== "SQUAD") {
      for (const pair of output.pairs as ProposedPair[]) {
        const [userAId, userBId] = [pair.userAId, pair.userBId].sort();
        if (!userAId || !userBId) continue;
        const match = await tx.match.create({
          data: {
            roundId,
            mode: mode as "DATE" | "FRIEND",
            userAId,
            userBId,
            score: pair.score,
            reasons: pair.reasons as unknown as Prisma.InputJsonValue,
          },
        });
        matchIds.push(match.id);
        await tx.pairHistory.upsert({
          where: { userAId_userBId_mode: { userAId, userBId, mode: mode as "DATE" | "FRIEND" } },
          create: { userAId, userBId, mode: mode as "DATE" | "FRIEND", outcome: "proposed" },
          update: { outcome: "proposed" },
        });
      }
    } else {
      for (const squad of output.squads as ProposedSquad[]) {
        const created = await tx.squad.create({
          data: {
            roundId,
            name: squad.name,
            score: squad.score,
            status: "PROPOSED",
            members: {
              create: squad.memberIds.map((userId) => ({ userId })),
            },
          },
        });
        squadIds.push(created.id);
      }
    }

    await tx.matchRound.update({
      where: { id: roundId },
      data: { status: "PREVIEWED", stats: output.stats as unknown as Prisma.InputJsonValue },
    });

    return { matchIds, squadIds };
  });
}
