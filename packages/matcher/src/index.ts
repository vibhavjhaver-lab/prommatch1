import { runMultiPassMatching } from "./pairMatching.js";
import { buildReasons } from "./reasons.js";
import { runSquadMatching } from "./squadMatching.js";
import type {
  BlockPair,
  PairHistoryEntry,
  ProposedPair,
  RoundInput,
  RoundOutput,
  RoundStats,
  UnmatchedReason,
  UserSnapshot,
} from "./types.js";

export * from "./types.js";
export { pairScore, geometricMeanCompat, oneWaySatisfaction, passesHardFilters } from "./scoring.js";
export { buildReasons } from "./reasons.js";
export { maximumWeightMatching, buildCandidateGraph } from "./pairMatching.js";
export { runSquadMatching } from "./squadMatching.js";
export { createRng, seededShuffle } from "./rng.js";

/** Marks eligibility per spec section 8 Step 1: active, not paused, mode
 * selected, under the open-proposal cap. Completeness (answers, photo
 * approval, etc.) is decided by the caller before building the snapshot —
 * this function only checks what's visible in the snapshot itself. */
function computeEligibility(
  user: Omit<UserSnapshot, "eligible">,
  mode: RoundInput["mode"],
  params: RoundInput["params"],
): boolean {
  if (!user.modes.includes(mode)) return false;
  const openCount = user.openProposalCount[mode] ?? 0;
  if (openCount >= params.proposalsPerUser) return false;
  return true;
}

function blockSet(blocks: BlockPair[]): Set<string> {
  const s = new Set<string>();
  for (const b of blocks) {
    s.add(`${b.a}:${b.b}`);
    s.add(`${b.b}:${b.a}`);
  }
  return s;
}

function historySet(history: PairHistoryEntry[]): Set<string> {
  const s = new Set<string>();
  for (const h of history) {
    s.add(`${h.a}:${h.b}:${h.mode}`);
    s.add(`${h.b}:${h.a}:${h.mode}`);
  }
  return s;
}

const squadRoleQuestionKey = "squad_role";

/**
 * Runs one match round: pure function, no I/O. Same (input, seed) always
 * produces the same output (spec section 8 Step 8).
 */
export function runRound(input: RoundInput, seed: number): RoundOutput {
  const users = input.users.map((u) => ({
    ...u,
    eligible: u.eligible && computeEligibility(u, input.mode, input.params),
  }));

  const bSet = blockSet(input.blocks);
  const hSet = historySet(input.history);

  if (input.mode === "SQUAD") {
    const roleOf = new Map<string, string | undefined>();
    for (const u of users) {
      const roleAnswer = u.answers.find((a) => {
        const q = input.questions.find((qq) => qq.key === squadRoleQuestionKey);
        return q && a.questionId === q.id;
      });
      roleOf.set(u.id, roleAnswer ? String(roleAnswer.value) : undefined);
    }

    const { squads, unmatchedIds } = runSquadMatching(users, input.questions, input.params, seed, roleOf);

    const unmatched: Record<string, UnmatchedReason> = {};
    for (const u of users) {
      if (!u.eligible) unmatched[u.id] = "ineligible";
    }
    for (const id of unmatchedIds) unmatched[id] = "below_threshold";

    const allMemberIds = new Set(squads.flatMap((s) => s.memberIds));
    for (const u of users) {
      if (u.eligible && u.modes.includes("SQUAD") && !allMemberIds.has(u.id) && !unmatched[u.id]) {
        unmatched[u.id] = "no_compatible_pool";
      }
    }

    const stats: RoundStats = {
      eligibleCount: users.filter((u) => u.eligible).length,
      proposedPairCount: 0,
      meanScore: squads.length
        ? squads.reduce((sum, s) => sum + s.score, 0) / squads.length
        : 0,
      unmatchedByReason: tallyReasons(unmatched),
      algorithm: "squad-annealing",
    };

    return { mode: "SQUAD", pairs: [], squads, unmatched, stats };
  }

  const { pairs, unmatched: unmatchedMap } = runMultiPassMatching(
    users,
    input.questions,
    input.params,
    input.mode,
    seed,
    { blockSet: bSet, historySet: hSet },
  );

  const byId = new Map(users.map((u) => [u.id, u] as const));
  const pairsWithReasons: ProposedPair[] = pairs.map((p) => {
    const a = byId.get(p.userAId);
    const b = byId.get(p.userBId);
    const reasons = a && b ? buildReasons(a, b, input.questions, input.mode) : [];
    return { ...p, reasons };
  });

  const unmatched: Record<string, UnmatchedReason> = {};
  for (const [id, reason] of unmatchedMap) unmatched[id] = reason;

  const stats: RoundStats = {
    eligibleCount: users.filter((u) => u.eligible).length,
    proposedPairCount: pairsWithReasons.length,
    meanScore: pairsWithReasons.length
      ? pairsWithReasons.reduce((sum, p) => sum + p.score, 0) / pairsWithReasons.length
      : 0,
    unmatchedByReason: tallyReasons(unmatched),
    algorithm: "greedy-2opt",
  };

  return { mode: input.mode, pairs: pairsWithReasons, squads: [], unmatched, stats };
}

function tallyReasons(unmatched: Record<string, UnmatchedReason>): RoundStats["unmatchedByReason"] {
  const tally: RoundStats["unmatchedByReason"] = {
    no_compatible_pool: 0,
    all_candidates_used: 0,
    below_threshold: 0,
    ineligible: 0,
  };
  for (const reason of Object.values(unmatched)) tally[reason]++;
  return tally;
}
