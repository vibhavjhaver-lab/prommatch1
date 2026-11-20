/**
 * Pure data types for the matcher. No I/O, no Prisma types — the caller
 * (packages/core/services/matching.ts) is responsible for turning database
 * rows into this shape and the output back into database writes.
 */

export type ModeKey = "DATE" | "FRIEND" | "SQUAD";
export type GenderKey = "WOMAN" | "MAN" | "NONBINARY" | "SELF_DESCRIBE" | "PREFER_NOT";
export type AnswerType = "likert5" | "choice" | "multiselect";
export type Scoring = "similarity" | "complementary" | "choiceExact" | "jaccard";

export interface QuestionDef {
  id: string;
  key: string;
  section: string;
  type: AnswerType;
  scoring: Scoring;
  weightDefault: number;
  modes: ModeKey[] | null; // null = all modes
}

export interface AnswerValue {
  questionId: string;
  /** number 1-5 for likert5, string for choice, string[] for multiselect */
  value: number | string | string[];
  importance: 0 | 1 | 2 | 3;
}

export interface UserSnapshot {
  id: string;
  yearOfStudy: number;
  department: string;
  interests: string[];
  promVibe: string;
  gender: GenderKey;
  seekingGenders: GenderKey[];
  yearMin: number;
  yearMax: number;
  sameDeptOk: boolean;
  modes: ModeKey[];
  squadSizeMin: number;
  squadSizeMax: number;
  squadFriendCode: string | null;
  /** question key -> disallowed answer value(s); violating any = hard filter */
  dealbreakers: Record<string, (string | number)[]>;
  /** hashes of excluded emails (never match me with these people) */
  excludedEmailHashes: string[];
  /** this user's hash, compared against others' excludedEmailHashes */
  ownEmailHash: string;
  answers: AnswerValue[];
  /** section name -> learned multiplier (0.5 - 2.0), from Step 7 */
  weightAdjust: Record<string, number>;
  openProposalCount: Record<ModeKey, number>;
  eligible: boolean;
}

export interface BlockPair {
  a: string;
  b: string;
}

export interface PairHistoryEntry {
  a: string;
  b: string;
  mode: ModeKey;
}

export interface RoundParams {
  minScore: number;
  proposalsPerUser: number;
  candidatesPerUser: number;
  choiceMismatch: number;
  /** blossom/greedy switches above this user count per the spec; we log which path ran */
  largeGraphThreshold: number;
}

export interface RoundInput {
  mode: ModeKey;
  users: UserSnapshot[];
  questions: QuestionDef[];
  blocks: BlockPair[];
  history: PairHistoryEntry[];
  params: RoundParams;
}

export interface MatchReason {
  text: string;
}

export interface ProposedPair {
  userAId: string;
  userBId: string;
  score: number;
  reasons: MatchReason[];
}

export interface ProposedSquad {
  name: string;
  memberIds: string[];
  score: number;
}

export type UnmatchedReason =
  | "no_compatible_pool"
  | "all_candidates_used"
  | "below_threshold"
  | "ineligible";

export interface RoundStats {
  eligibleCount: number;
  proposedPairCount: number;
  meanScore: number;
  unmatchedByReason: Record<UnmatchedReason, number>;
  algorithm: "greedy-2opt" | "squad-annealing";
}

export interface RoundOutput {
  mode: ModeKey;
  pairs: ProposedPair[];
  squads: ProposedSquad[];
  unmatched: Record<string, UnmatchedReason>;
  stats: RoundStats;
}
