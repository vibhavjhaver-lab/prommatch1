import { describe, expect, it } from "vitest";
import { geometricMeanCompat, pairScore, passesHardFilters } from "./scoring.js";
import { choice, likert, makeUser, testParams, testQuestions } from "./test-helpers.js";

describe("geometricMeanCompat", () => {
  it("is symmetric: score(A,B) === score(B,A)", () => {
    const a = makeUser({
      id: "a",
      answers: [likert("q-night", 5), choice("q-afterparty", "late food run")],
    });
    const b = makeUser({
      id: "b",
      gender: "MAN",
      seekingGenders: ["WOMAN"],
      answers: [likert("q-night", 2), choice("q-afterparty", "home")],
    });

    const ab = geometricMeanCompat(a, b, testQuestions, testParams, "DATE");
    const ba = geometricMeanCompat(b, a, testQuestions, testParams, "DATE");
    expect(ab).toBeCloseTo(ba, 10);
  });

  it("scores identical answers at (near) maximum similarity", () => {
    const sharedAnswers = [likert("q-night", 4), choice("q-afterparty", "afterparty")];
    const a = makeUser({ id: "a", answers: sharedAnswers });
    const b = makeUser({ id: "b", gender: "MAN", seekingGenders: ["WOMAN"], answers: sharedAnswers });

    const compat = geometricMeanCompat(a, b, testQuestions, testParams, "DATE");
    expect(compat).toBeGreaterThan(0.95);
  });
});

describe("pairScore", () => {
  it("returns a value between 0 and 100", () => {
    const a = makeUser({ id: "a", answers: [likert("q-night", 1)] });
    const b = makeUser({ id: "b", gender: "MAN", seekingGenders: ["WOMAN"], answers: [likert("q-night", 5)] });
    const score = pairScore(a, b, testQuestions, testParams, "DATE");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("gives a bonus for matching prom vibe", () => {
    const base = { answers: [likert("q-night", 3)] };
    const a = makeUser({ id: "a", promVibe: "Chill and cosy", ...base });
    const bSameVibe = makeUser({
      id: "b1",
      gender: "MAN",
      seekingGenders: ["WOMAN"],
      promVibe: "Chill and cosy",
      ...base,
    });
    const bDiffVibe = makeUser({
      id: "b2",
      gender: "MAN",
      seekingGenders: ["WOMAN"],
      promVibe: "Main-character energy",
      ...base,
    });

    const scoreSame = pairScore(a, bSameVibe, testQuestions, testParams, "DATE");
    const scoreDiff = pairScore(a, bDiffVibe, testQuestions, testParams, "DATE");
    expect(scoreSame).toBeGreaterThan(scoreDiff);
  });
});

describe("passesHardFilters", () => {
  it("rejects a pair outside each other's gender preference in DATE mode", () => {
    const a = makeUser({ id: "a", gender: "WOMAN", seekingGenders: ["WOMAN"] });
    const b = makeUser({ id: "b", gender: "WOMAN", seekingGenders: ["MAN"] });
    expect(
      passesHardFilters(a, b, { blockSet: new Set(), historySet: new Set(), questions: testQuestions, mode: "DATE" }),
    ).toBe(false);
  });

  it("rejects a pair outside each other's year range", () => {
    const a = makeUser({ id: "a", yearOfStudy: 1, yearMin: 1, yearMax: 2 });
    const b = makeUser({ id: "b", gender: "MAN", seekingGenders: ["WOMAN"], yearOfStudy: 4, yearMin: 3, yearMax: 5 });
    expect(
      passesHardFilters(a, b, { blockSet: new Set(), historySet: new Set(), questions: testQuestions, mode: "DATE" }),
    ).toBe(false);
  });

  it("rejects a pair in the same department when either has sameDeptOk=false", () => {
    const a = makeUser({ id: "a", department: "Mechanical", sameDeptOk: false });
    const b = makeUser({ id: "b", gender: "MAN", seekingGenders: ["WOMAN"], department: "Mechanical" });
    expect(
      passesHardFilters(a, b, { blockSet: new Set(), historySet: new Set(), questions: testQuestions, mode: "DATE" }),
    ).toBe(false);
  });

  it("rejects a blocked pair in either direction", () => {
    const a = makeUser({ id: "a" });
    const b = makeUser({ id: "b", gender: "MAN", seekingGenders: ["WOMAN"] });
    const blockSet = new Set(["a:b"]);
    expect(
      passesHardFilters(a, b, { blockSet, historySet: new Set(), questions: testQuestions, mode: "DATE" }),
    ).toBe(false);
  });

  it("rejects a pair already in history for that mode", () => {
    const a = makeUser({ id: "a" });
    const b = makeUser({ id: "b", gender: "MAN", seekingGenders: ["WOMAN"] });
    const historySet = new Set(["a:b:DATE"]);
    expect(
      passesHardFilters(a, b, { blockSet: new Set(), historySet, questions: testQuestions, mode: "DATE" }),
    ).toBe(false);
    // but history for a different mode doesn't block it
    expect(
      passesHardFilters(a, b, { blockSet: new Set(), historySet, questions: testQuestions, mode: "FRIEND" }),
    ).toBe(true);
  });

  it("rejects a pair violating either side's dealbreaker", () => {
    const a = makeUser({
      id: "a",
      dealbreakers: { afterparty: ["home"] },
    });
    const b = makeUser({
      id: "b",
      gender: "MAN",
      seekingGenders: ["WOMAN"],
      answers: [choice("q-afterparty", "home")],
    });
    expect(
      passesHardFilters(a, b, { blockSet: new Set(), historySet: new Set(), questions: testQuestions, mode: "DATE" }),
    ).toBe(false);
  });

  it("PREFER_NOT only matches someone open to every gender", () => {
    const a = makeUser({ id: "a", gender: "PREFER_NOT", seekingGenders: ["MAN"] });
    const bNotOpen = makeUser({ id: "b1", gender: "MAN", seekingGenders: ["WOMAN", "PREFER_NOT"] });
    const bOpen = makeUser({
      id: "b2",
      gender: "MAN",
      seekingGenders: ["WOMAN", "MAN", "NONBINARY", "SELF_DESCRIBE", "PREFER_NOT"],
    });
    expect(
      passesHardFilters(a, bNotOpen, {
        blockSet: new Set(),
        historySet: new Set(),
        questions: testQuestions,
        mode: "DATE",
      }),
    ).toBe(false);
    expect(
      passesHardFilters(a, bOpen, { blockSet: new Set(), historySet: new Set(), questions: testQuestions, mode: "DATE" }),
    ).toBe(true);
  });
});
