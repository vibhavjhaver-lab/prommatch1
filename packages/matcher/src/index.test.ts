import { describe, expect, it } from "vitest";
import { runRound } from "./index.js";
import { createRng } from "./rng.js";
import { choice, likert, makeUser, testParams, testQuestions } from "./test-helpers.js";
import type { GenderKey, RoundInput, UserSnapshot } from "./types.js";

function buildSimpleRound(overrides: Partial<RoundInput> = {}): RoundInput {
  const users: UserSnapshot[] = [
    makeUser({ id: "a1", gender: "WOMAN", seekingGenders: ["MAN"], answers: [likert("q-night", 5), choice("q-afterparty", "late food run")] }),
    makeUser({ id: "a2", gender: "MAN", seekingGenders: ["WOMAN"], answers: [likert("q-night", 5), choice("q-afterparty", "late food run")] }),
    makeUser({ id: "a3", gender: "WOMAN", seekingGenders: ["MAN"], answers: [likert("q-night", 1), choice("q-afterparty", "home")] }),
    makeUser({ id: "a4", gender: "MAN", seekingGenders: ["WOMAN"], answers: [likert("q-night", 1), choice("q-afterparty", "home")] }),
  ];

  return {
    mode: "DATE",
    users,
    questions: testQuestions,
    blocks: [],
    history: [],
    params: testParams,
    ...overrides,
  };
}

describe("runRound determinism", () => {
  it("produces identical output for the same seed and input", () => {
    const input = buildSimpleRound();
    const out1 = runRound(input, 42);
    const out2 = runRound(input, 42);
    expect(out1).toEqual(out2);
  });

  it("is very likely to differ in pairing order for a different seed on a larger population", () => {
    const users = generateSyntheticUsers(40, 7);
    const input: RoundInput = {
      mode: "DATE",
      users,
      questions: testQuestions,
      blocks: [],
      history: [],
      params: testParams,
    };
    const out1 = runRound(input, 1);
    const out2 = runRound(input, 2);
    // Not a strict guarantee, but with 40 users and real score ties it's
    // exceedingly unlikely the full proposal set is byte-identical.
    expect(JSON.stringify(out1.pairs)).not.toEqual(JSON.stringify(out2.pairs));
  });
});

describe("runRound hard filter safety", () => {
  it("never proposes a pair that violates a hard filter", () => {
    const users = generateSyntheticUsers(120, 99);
    const input: RoundInput = {
      mode: "DATE",
      users,
      questions: testQuestions,
      blocks: [{ a: users[0]!.id, b: users[1]!.id }],
      history: [{ a: users[2]!.id, b: users[3]!.id, mode: "DATE" }],
      params: testParams,
    };
    const output = runRound(input, 5);
    const byId = new Map(users.map((u) => [u.id, u] as const));

    for (const pair of output.pairs) {
      const a = byId.get(pair.userAId)!;
      const b = byId.get(pair.userBId)!;
      expect(a.yearOfStudy).toBeGreaterThanOrEqual(b.yearMin);
      expect(a.yearOfStudy).toBeLessThanOrEqual(b.yearMax);
      expect(b.yearOfStudy).toBeGreaterThanOrEqual(a.yearMin);
      expect(b.yearOfStudy).toBeLessThanOrEqual(a.yearMax);

      const blocked =
        (pair.userAId === users[0]!.id && pair.userBId === users[1]!.id) ||
        (pair.userAId === users[1]!.id && pair.userBId === users[0]!.id);
      expect(blocked).toBe(false);

      const inHistory =
        (pair.userAId === users[2]!.id && pair.userBId === users[3]!.id) ||
        (pair.userAId === users[3]!.id && pair.userBId === users[2]!.id);
      expect(inHistory).toBe(false);
    }
  });

  it("never gives a user more than proposalsPerUser proposals", () => {
    const users = generateSyntheticUsers(150, 11);
    const input: RoundInput = {
      mode: "DATE",
      users,
      questions: testQuestions,
      blocks: [],
      history: [],
      params: testParams,
    };
    const output = runRound(input, 3);
    const countByUser = new Map<string, number>();
    for (const p of output.pairs) {
      countByUser.set(p.userAId, (countByUser.get(p.userAId) ?? 0) + 1);
      countByUser.set(p.userBId, (countByUser.get(p.userBId) ?? 0) + 1);
    }
    for (const count of countByUser.values()) {
      expect(count).toBeLessThanOrEqual(testParams.proposalsPerUser);
    }
  });
});

describe("runRound at scale (spec section 8 Step 8 acceptance bar)", () => {
  it("matches at least 90% of users who have 5+ feasible candidates, on a 1000-user synthetic population", () => {
    const users = generateSyntheticUsers(1000, 2026);
    const input: RoundInput = {
      mode: "DATE",
      users,
      questions: testQuestions,
      blocks: [],
      history: [],
      params: testParams,
    };

    const output = runRound(input, 2026);
    const matchedIds = new Set(output.pairs.flatMap((p) => [p.userAId, p.userBId]));

    // Approximate "5+ feasible candidates" by opposite-gender-preference
    // count within year range, matching the hard filters used above.
    let usersWithEnoughCandidates = 0;
    let matchedAmongThose = 0;
    for (const u of users) {
      let candidates = 0;
      for (const other of users) {
        if (other.id === u.id) continue;
        if (!u.seekingGenders.includes(other.gender)) continue;
        if (!other.seekingGenders.includes(u.gender)) continue;
        if (other.yearOfStudy < u.yearMin || other.yearOfStudy > u.yearMax) continue;
        if (u.yearOfStudy < other.yearMin || u.yearOfStudy > other.yearMax) continue;
        candidates++;
        if (candidates >= 5) break;
      }
      if (candidates >= 5) {
        usersWithEnoughCandidates++;
        if (matchedIds.has(u.id)) matchedAmongThose++;
      }
    }

    const rate = usersWithEnoughCandidates === 0 ? 1 : matchedAmongThose / usersWithEnoughCandidates;
    expect(rate).toBeGreaterThanOrEqual(0.9);
  }, 30_000);
});

/** Deterministic synthetic population generator — no Math.random(), no faker. */
function generateSyntheticUsers(count: number, seed: number): UserSnapshot[] {
  const rng = createRng(seed);
  const genders: GenderKey[] = ["WOMAN", "MAN"];
  const vibes = ["Classic elegance", "Dance-floor legend", "Chill and cosy", "Main-character energy"];
  const interestPool = ["music", "dance", "gaming", "art", "sports", "movies", "coding", "travel"];

  const users: UserSnapshot[] = [];
  for (let i = 0; i < count; i++) {
    const gender = genders[Math.floor(rng() * genders.length)] ?? "WOMAN";
    const seeking: GenderKey[] = gender === "WOMAN" ? ["MAN"] : ["WOMAN"];
    const year = 1 + Math.floor(rng() * 4);
    const nightValue = 1 + Math.floor(rng() * 5);
    const vibe = vibes[Math.floor(rng() * vibes.length)] ?? "Chill and cosy";
    const interests = interestPool.filter(() => rng() < 0.3);

    users.push(
      makeUser({
        id: `u${i}`,
        gender,
        seekingGenders: seeking,
        yearOfStudy: year,
        yearMin: Math.max(1, year - 2),
        yearMax: Math.min(5, year + 2),
        promVibe: vibe,
        interests: interests.length ? interests : ["music"],
        answers: [
          likert("q-night", nightValue),
          choice("q-afterparty", rng() < 0.5 ? "late food run" : "home"),
        ],
      }),
    );
  }
  return users;
}
