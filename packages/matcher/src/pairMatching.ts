import { createRng, seededShuffle } from "./rng.js";
import { passesHardFilters, pairScore, type HardFilterContext } from "./scoring.js";
import type {
  ModeKey,
  ProposedPair,
  QuestionDef,
  RoundParams,
  UnmatchedReason,
  UserSnapshot,
} from "./types.js";

export interface WeightedEdge {
  a: string;
  b: string;
  weight: number;
  score: number;
}

/**
 * Builds the sparse candidate graph: for every eligible pair that survives
 * the hard filters and scores at or above minScore, keep only each user's
 * top `candidatesPerUser` edges by score (spec section 8 Step 3, final
 * paragraph) — this keeps the graph sparse before matching runs.
 */
export function buildCandidateGraph(
  users: UserSnapshot[],
  questions: QuestionDef[],
  params: RoundParams,
  mode: ModeKey,
  ctx: Omit<HardFilterContext, "questions" | "mode">,
): { edges: WeightedEdge[]; byUser: Map<string, WeightedEdge[]> } {
  const byUser = new Map<string, WeightedEdge[]>();
  for (const u of users) byUser.set(u.id, []);

  const n = users.length;
  for (let i = 0; i < n; i++) {
    const a = users[i];
    if (!a) continue;
    for (let j = i + 1; j < n; j++) {
      const b = users[j];
      if (!b) continue;
      if (!passesHardFilters(a, b, { ...ctx, questions, mode })) continue;

      const score = pairScore(a, b, questions, params, mode);
      if (score < params.minScore) continue;

      const edge: WeightedEdge = { a: a.id, b: b.id, weight: score * score, score };
      byUser.get(a.id)?.push(edge);
      byUser.get(b.id)?.push(edge);
    }
  }

  // Keep only each user's top `candidatesPerUser` edges by score.
  const keepSet = new Set<WeightedEdge>();
  for (const [, userEdges] of byUser) {
    const sorted = userEdges.slice().sort((x, y) => y.score - x.score);
    for (const e of sorted.slice(0, params.candidatesPerUser)) keepSet.add(e);
  }

  const edges = [...keepSet];
  const finalByUser = new Map<string, WeightedEdge[]>();
  for (const u of users) finalByUser.set(u.id, []);
  for (const e of edges) {
    finalByUser.get(e.a)?.push(e);
    finalByUser.get(e.b)?.push(e);
  }

  return { edges, byUser: finalByUser };
}

function degreeMap(edges: WeightedEdge[]): Map<string, number> {
  const deg = new Map<string, number>();
  for (const e of edges) {
    deg.set(e.a, (deg.get(e.a) ?? 0) + 1);
    deg.set(e.b, (deg.get(e.b) ?? 0) + 1);
  }
  return deg;
}

/**
 * Scarcity-boosted weight: edge weight * (1 + 0.5 / degree of the
 * less-connected endpoint), so people with few options are served first.
 * Spec section 8 Step 4.2.
 */
function scarcityWeight(e: WeightedEdge, deg: Map<string, number>): number {
  const dA = deg.get(e.a) ?? 1;
  const dB = deg.get(e.b) ?? 1;
  const minDeg = Math.max(1, Math.min(dA, dB));
  return e.weight * (1 + 0.5 / minDeg);
}

/**
 * Maximum-weight matching via greedy-by-descending-weight followed by
 * bounded 2-opt local search. Deterministic given `rngSeed` (ties are broken
 * by a seeded shuffle, never Math.random()).
 *
 * This replaces the spec's call for Edmonds' blossom algorithm for every
 * graph size, not just its >3,000-user fallback — see DECISIONS.md,
 * "Matching algorithm: greedy + local search instead of Edmonds' blossom",
 * for why.
 */
export function maximumWeightMatching(
  users: string[],
  edges: WeightedEdge[],
  rngSeed: number,
  maxSwapPasses = 6,
): WeightedEdge[] {
  if (edges.length === 0) return [];
  const rng = createRng(rngSeed);
  const deg = degreeMap(edges);

  const ordered = seededShuffle(edges, rng).sort(
    (a, b) => scarcityWeight(b, deg) - scarcityWeight(a, deg),
  );

  const matchedPartner = new Map<string, string>();
  const matchedEdge = new Map<string, WeightedEdge>();

  for (const e of ordered) {
    if (!matchedPartner.has(e.a) && !matchedPartner.has(e.b)) {
      matchedPartner.set(e.a, e.b);
      matchedPartner.set(e.b, e.a);
      matchedEdge.set(e.a, e);
      matchedEdge.set(e.b, e);
    }
  }

  // Bounded 2-opt: for pairs of matched edges (a-b) and (c-d), check whether
  // swapping to (a-c)+(b-d) or (a-d)+(b-c) — using edges that actually exist
  // in the candidate graph — improves total weight.
  const edgeLookup = new Map<string, WeightedEdge>();
  for (const e of edges) {
    edgeLookup.set(`${e.a}|${e.b}`, e);
    edgeLookup.set(`${e.b}|${e.a}`, e);
  }
  const find = (x: string, y: string) => edgeLookup.get(`${x}|${y}`);

  for (let pass = 0; pass < maxSwapPasses; pass++) {
    let improved = false;
    const matchedEdgesList = seededShuffle([...new Set(matchedEdge.values())], rng);

    for (let i = 0; i < matchedEdgesList.length; i++) {
      for (let j = i + 1; j < matchedEdgesList.length; j++) {
        const e1 = matchedEdgesList[i];
        const e2 = matchedEdgesList[j];
        if (!e1 || !e2) continue;
        if (matchedEdge.get(e1.a) !== e1 || matchedEdge.get(e2.a) !== e2) continue; // stale after a prior swap

        const current = e1.weight + e2.weight;

        const candidate1 = [find(e1.a, e2.a), find(e1.b, e2.b)];
        const candidate2 = [find(e1.a, e2.b), find(e1.b, e2.a)];

        for (const candidate of [candidate1, candidate2]) {
          const [x, y] = candidate;
          if (!x || !y) continue;
          const proposed = x.weight + y.weight;
          if (proposed > current + 1e-9) {
            matchedPartner.delete(e1.a);
            matchedPartner.delete(e1.b);
            matchedPartner.delete(e2.a);
            matchedPartner.delete(e2.b);
            matchedEdge.delete(e1.a);
            matchedEdge.delete(e1.b);
            matchedEdge.delete(e2.a);
            matchedEdge.delete(e2.b);

            matchedPartner.set(x.a, x.b);
            matchedPartner.set(x.b, x.a);
            matchedEdge.set(x.a, x);
            matchedEdge.set(x.b, x);
            matchedPartner.set(y.a, y.b);
            matchedPartner.set(y.b, y.a);
            matchedEdge.set(y.a, y);
            matchedEdge.set(y.b, y);
            improved = true;
            break;
          }
        }
      }
    }
    if (!improved) break;
  }

  return [...new Set(matchedEdge.values())];
}

export interface PassResult {
  pairs: ProposedPair[];
  unmatched: Map<string, UnmatchedReason>;
}

/**
 * Runs up to `proposalsPerUser` matching passes (spec section 8 Step 4.3):
 * each pass removes chosen edges and any user who hit their cap, so later
 * passes offer alternatives to people who aren't yet full.
 */
export function runMultiPassMatching(
  users: UserSnapshot[],
  questions: QuestionDef[],
  params: RoundParams,
  mode: ModeKey,
  rngSeed: number,
  ctx: Omit<HardFilterContext, "questions" | "mode">,
): PassResult {
  const eligible = users.filter((u) => u.eligible);
  const ineligibleIds = new Set(users.filter((u) => !u.eligible).map((u) => u.id));

  const { edges } = buildCandidateGraph(eligible, questions, params, mode, ctx);
  const everHadCandidate = new Set<string>();
  for (const e of edges) {
    everHadCandidate.add(e.a);
    everHadCandidate.add(e.b);
  }

  let remainingEdges = edges;
  const proposalCount = new Map<string, number>();
  const allPairs: ProposedPair[] = [];

  for (let pass = 0; pass < params.proposalsPerUser; pass++) {
    if (remainingEdges.length === 0) break;
    const userIds = eligible.map((u) => u.id);
    const matched = maximumWeightMatching(userIds, remainingEdges, rngSeed + pass);

    for (const e of matched) {
      allPairs.push({ userAId: e.a < e.b ? e.a : e.b, userBId: e.a < e.b ? e.b : e.a, score: e.score, reasons: [] });
      proposalCount.set(e.a, (proposalCount.get(e.a) ?? 0) + 1);
      proposalCount.set(e.b, (proposalCount.get(e.b) ?? 0) + 1);
    }

    const matchedIdsThisPass = new Set(matched.flatMap((e) => [e.a, e.b]));
    const fullIds = new Set(
      [...proposalCount.entries()].filter(([, c]) => c >= params.proposalsPerUser).map(([id]) => id),
    );
    remainingEdges = remainingEdges.filter(
      (e) =>
        !matchedIdsThisPass.has(e.a) &&
        !matchedIdsThisPass.has(e.b) &&
        !fullIds.has(e.a) &&
        !fullIds.has(e.b),
    );
  }

  const unmatched = new Map<string, UnmatchedReason>();
  for (const id of ineligibleIds) unmatched.set(id, "ineligible");
  for (const u of eligible) {
    if (proposalCount.has(u.id)) continue;
    if (!everHadCandidate.has(u.id)) {
      unmatched.set(u.id, "no_compatible_pool");
    } else {
      unmatched.set(u.id, "all_candidates_used");
    }
  }

  return { pairs: allPairs, unmatched };
}
