import type { GenderKey, ModeKey, QuestionDef, RoundParams, UserSnapshot } from "./types.js";

export const testQuestions: QuestionDef[] = [
  { id: "q-night", key: "night_energy", section: "Prom night", type: "likert5", scoring: "similarity", weightDefault: 1, modes: null },
  { id: "q-afterparty", key: "afterparty", section: "Prom night", type: "choice", scoring: "choiceExact", weightDefault: 1, modes: null },
  { id: "q-music", key: "music", section: "Lifestyle", type: "multiselect", scoring: "jaccard", weightDefault: 1, modes: null },
  { id: "q-planner", key: "planner", section: "Personality", type: "likert5", scoring: "complementary", weightDefault: 1, modes: null },
  { id: "q-pda", key: "pda", section: "Expectations", type: "likert5", scoring: "similarity", weightDefault: 1, modes: ["DATE"] },
  { id: "q-squadrole", key: "squad_role", section: "Squad", type: "choice", scoring: "choiceExact", weightDefault: 1, modes: ["SQUAD"] },
];

export const testParams: RoundParams = {
  minScore: 30,
  proposalsPerUser: 3,
  candidatesPerUser: 40,
  choiceMismatch: 0.2,
  largeGraphThreshold: 3000,
};

export function makeUser(overrides: Partial<UserSnapshot> & { id: string }): UserSnapshot {
  const gender: GenderKey = overrides.gender ?? "WOMAN";
  const seeking: GenderKey[] = overrides.seekingGenders ?? ["MAN"];
  const modes: ModeKey[] = overrides.modes ?? ["DATE", "FRIEND"];

  return {
    yearOfStudy: 2,
    department: "Computer Science",
    interests: ["music", "gaming"],
    promVibe: "Dance-floor legend",
    gender,
    seekingGenders: seeking,
    yearMin: 1,
    yearMax: 5,
    sameDeptOk: true,
    modes,
    squadSizeMin: 4,
    squadSizeMax: 8,
    squadFriendCode: null,
    dealbreakers: {},
    excludedEmailHashes: [],
    ownEmailHash: `hash-${overrides.id}`,
    answers: [],
    weightAdjust: {},
    openProposalCount: { DATE: 0, FRIEND: 0, SQUAD: 0 },
    eligible: true,
    ...overrides,
  };
}

export function likert(questionId: string, value: number, importance: 0 | 1 | 2 | 3 = 3) {
  return { questionId, value, importance };
}

export function choice(questionId: string, value: string, importance: 0 | 1 | 2 | 3 = 3) {
  return { questionId, value, importance };
}

export function multiselect(questionId: string, value: string[], importance: 0 | 1 | 2 | 3 = 3) {
  return { questionId, value, importance };
}
