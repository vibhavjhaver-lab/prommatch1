import { createRng } from "./rng.js";
import { passesHardFilters, pairScore, type HardFilterContext } from "./scoring.js";
import type { ProposedSquad, QuestionDef, RoundParams, UserSnapshot } from "./types.js";

const SQUAD_NAME_ADJECTIVES = [
  "Velvet",
  "Neon",
  "Golden",
  "Midnight",
  "Rogue",
  "Electric",
  "Silver",
  "Crimson",
  "Cosmic",
  "Stellar",
];
const SQUAD_NAME_NOUNS = [
  "Comets",
  "Foxes",
  "Mirage",
  "Legends",
  "Waves",
  "Lanterns",
  "Sparks",
  "Nova",
  "Wolves",
  "Echoes",
];

function squadName(rng: () => number): string {
  const adj = SQUAD_NAME_ADJECTIVES[Math.floor(rng() * SQUAD_NAME_ADJECTIVES.length)] ?? "Velvet";
  const noun = SQUAD_NAME_NOUNS[Math.floor(rng() * SQUAD_NAME_NOUNS.length)] ?? "Comets";
  return `${adj} ${noun}`;
}

interface PairScoreCache {
  get(a: string, b: string): number | undefined;
  compatible(a: string, b: string): boolean;
}

function buildPairCache(
  users: UserSnapshot[],
  questions: QuestionDef[],
  params: RoundParams,
  ctx: Omit<HardFilterContext, "questions" | "mode">,
): PairScoreCache {
  const scores = new Map<string, number>();
  const compat = new Map<string, boolean>();
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const a = users[i];
      const b = users[j];
      if (!a || !b) continue;
      const k = key(a.id, b.id);
      const ok = passesHardFilters(a, b, { ...ctx, questions, mode: "SQUAD" });
      compat.set(k, ok);
      if (ok) scores.set(k, pairScore(a, b, questions, params, "SQUAD"));
    }
  }

  return {
    get: (a, b) => scores.get(key(a, b)),
    compatible: (a, b) => {
      if (a === b) return true;
      return compat.get(key(a, b)) ?? false;
    },
  };
}

function meanPairwiseScore(members: string[], cache: PairScoreCache): number {
  if (members.length < 2) return 0;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const mi = members[i];
      const mj = members[j];
      if (!mi || !mj) continue;
      sum += cache.get(mi, mj) ?? 0;
      count++;
    }
  }
  return count === 0 ? 0 : sum / count;
}

function roleDiversityBonus(members: string[], roleOf: Map<string, string | undefined>): number {
  const roles = new Set(members.map((m) => roleOf.get(m)).filter(Boolean));
  return roles.size * 5;
}

function allPairsCompatible(members: string[], cache: PairScoreCache): boolean {
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const mi = members[i];
      const mj = members[j];
      if (!mi || !mj) continue;
      if (!cache.compatible(mi, mj)) return false;
    }
  }
  return true;
}

export interface SquadMatchResult {
  squads: ProposedSquad[];
  unmatchedIds: string[];
}

/**
 * Squad matching per spec section 8 Step 5: pre-cluster friend-code seeds,
 * build greedily, then improve with bounded simulated annealing (swap or
 * move one user), objective = sum of mean pairwise score + role diversity
 * bonus - large penalty per constraint violation.
 */
export function runSquadMatching(
  users: UserSnapshot[],
  questions: QuestionDef[],
  params: RoundParams,
  rngSeed: number,
  squadRoleOf: Map<string, string | undefined>,
  iterations = 20000,
): SquadMatchResult {
  const eligible = users.filter((u) => u.eligible && u.modes.includes("SQUAD"));
  if (eligible.length === 0) return { squads: [], unmatchedIds: [] };

  const rng = createRng(rngSeed);
  const cache = buildPairCache(eligible, questions, params, {
    blockSet: new Set(),
    historySet: new Set(),
  });

  // Step 1: pre-cluster friend-code seeds (max 4 per code).
  const byCode = new Map<string, UserSnapshot[]>();
  const noCode: UserSnapshot[] = [];
  for (const u of eligible) {
    if (u.squadFriendCode) {
      const list = byCode.get(u.squadFriendCode) ?? [];
      list.push(u);
      byCode.set(u.squadFriendCode, list);
    } else {
      noCode.push(u);
    }
  }

  let squads: string[][] = [];
  for (const [, members] of byCode) {
    squads.push(members.slice(0, 4).map((m) => m.id));
  }

  // Step 3: greedily build remaining squads — start from the user with
  // fewest candidates, add whoever maximises mean pairwise score, stop at
  // the largest size inside every member's range.
  const assigned = new Set(squads.flat());
  const pool = noCode.filter((u) => !assigned.has(u.id)).map((u) => u.id);
  const byId = new Map(eligible.map((u) => [u.id, u] as const));

  const candidateCount = new Map<string, number>();
  for (const id of pool) {
    let count = 0;
    for (const other of pool) if (other !== id && cache.compatible(id, other)) count++;
    candidateCount.set(id, count);
  }

  const sortedPool = pool
    .slice()
    .sort((a, b) => (candidateCount.get(a) ?? 0) - (candidateCount.get(b) ?? 0));
  const remaining = new Set(sortedPool);

  while (remaining.size > 0) {
    const seedId = [...remaining][0];
    if (seedId === undefined) break;
    remaining.delete(seedId);
    const seed = byId.get(seedId);
    if (!seed) continue;
    const squad = [seedId];
    const maxSize = seed.squadSizeMax;

    while (squad.length < maxSize) {
      let best: string | undefined;
      let bestScore = -Infinity;
      for (const candidateId of remaining) {
        const candidate = byId.get(candidateId);
        if (!candidate) continue;
        if (squad.length + 1 > candidate.squadSizeMax) continue;
        if (!allPairsCompatible([...squad, candidateId], cache)) continue;
        const score = meanPairwiseScore([...squad, candidateId], cache);
        if (score > bestScore) {
          bestScore = score;
          best = candidateId;
        }
      }
      if (best === undefined) break;
      squad.push(best);
      remaining.delete(best);
      if (squad.length >= seed.squadSizeMin && remaining.size === 0) break;
    }
    squads.push(squad);
  }

  // Step 4: simulated annealing — swap or move one user between squads.
  function objective(allSquads: string[][]): number {
    let total = 0;
    for (const s of allSquads) {
      total += meanPairwiseScore(s, cache) * s.length; // weight by size so bigger good squads count more
      total += roleDiversityBonus(s, squadRoleOf);
      for (let i = 0; i < s.length; i++) {
        for (let j = i + 1; j < s.length; j++) {
          const si = s[i];
          const sj = s[j];
          if (!si || !sj) continue;
          if (!cache.compatible(si, sj)) total -= 1000;
        }
      }
    }
    return total;
  }

  let currentScore = objective(squads);
  for (let iter = 0; iter < iterations && squads.length > 1; iter++) {
    const temperature = 1 - iter / iterations;
    const si = Math.floor(rng() * squads.length);
    const sj = Math.floor(rng() * squads.length);
    if (si === sj) continue;
    const squadI = squads[si];
    const squadJ = squads[sj];
    if (!squadI || !squadJ || squadI.length === 0 || squadJ.length === 0) continue;

    const moveOrSwap = rng() < 0.5 ? "move" : "swap";
    const next = squads.map((s) => s.slice());
    const nsi = next[si];
    const nsj = next[sj];
    if (!nsi || !nsj) continue;

    if (moveOrSwap === "move") {
      const idx = Math.floor(rng() * nsi.length);
      const member = nsi[idx];
      if (member === undefined) continue;
      const memberUser = byId.get(member);
      if (!memberUser || nsj.length + 1 > memberUser.squadSizeMax) continue;
      nsi.splice(idx, 1);
      nsj.push(member);
    } else {
      const idxI = Math.floor(rng() * nsi.length);
      const idxJ = Math.floor(rng() * nsj.length);
      const tmp = nsi[idxI];
      const otherTmp = nsj[idxJ];
      if (tmp === undefined || otherTmp === undefined) continue;
      nsi[idxI] = otherTmp;
      nsj[idxJ] = tmp;
    }

    if (nsi.length === 0) continue;

    const nextScore = objective(next);
    const delta = nextScore - currentScore;
    if (delta > 0 || rng() < Math.exp(delta / Math.max(0.01, temperature * 50))) {
      squads = next;
      currentScore = nextScore;
    }
  }

  // Step 5: merge leftover squads below minimum size into the closest squad
  // below its max; otherwise report as unmatched.
  const final: string[][] = [];
  const leftovers: string[][] = [];
  for (const s of squads) {
    const minNeeded = Math.min(...s.map((id) => byId.get(id)?.squadSizeMin ?? 4));
    if (s.length >= minNeeded) final.push(s);
    else leftovers.push(s);
  }

  for (const leftover of leftovers) {
    let bestTarget: string[] | undefined;
    let bestScore = -Infinity;
    for (const target of final) {
      const maxAllowed = Math.min(...target.map((id) => byId.get(id)?.squadSizeMax ?? 8));
      if (target.length + leftover.length > maxAllowed) continue;
      const merged = [...target, ...leftover];
      if (!allPairsCompatible(merged, cache)) continue;
      const score = meanPairwiseScore(merged, cache);
      if (score > bestScore) {
        bestScore = score;
        bestTarget = target;
      }
    }
    if (bestTarget) {
      bestTarget.push(...leftover);
    } else {
      final.push(...leftover.map((id) => [id])); // will be filtered to unmatched below
    }
  }

  const unmatchedIds: string[] = [];
  const confirmedSquads: ProposedSquad[] = [];
  for (const s of final) {
    const minNeeded = Math.min(...s.map((id) => byId.get(id)?.squadSizeMin ?? 4));
    if (s.length < minNeeded) {
      unmatchedIds.push(...s);
      continue;
    }
    confirmedSquads.push({
      name: squadName(rng),
      memberIds: s,
      score: meanPairwiseScore(s, cache),
    });
  }

  return { squads: confirmedSquads, unmatchedIds };
}
