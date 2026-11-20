import type { AnswerValue, GenderKey, ModeKey, QuestionDef, RoundParams, UserSnapshot } from "./types.js";

// ---------- Importance -> weight ----------

/** Importance 0/1/2/3 -> base weight, per spec section 8 Step 3. */
const IMPORTANCE_WEIGHT = [0, 1, 5, 20] as const;

function sectionMultiplier(user: UserSnapshot, section: string): number {
  const adj = user.weightAdjust[section];
  if (adj === undefined) return 1;
  return Math.min(2.0, Math.max(0.5, adj));
}

function questionWeight(user: UserSnapshot, q: QuestionDef, answer: AnswerValue | undefined): number {
  if (!answer) return 0;
  const importanceWeight = IMPORTANCE_WEIGHT[answer.importance] ?? 0;
  if (importanceWeight === 0) return 0;
  return importanceWeight * q.weightDefault;
}

// ---------- Per-question similarity, each in [0, 1] ----------

/** 5-point similarity: 1 - |a-b|/4 */
function likertSimilarity(a: number, b: number): number {
  return 1 - Math.abs(a - b) / 4;
}

/**
 * 5-point complementary: peaks when the gap is 1 or 2.
 * s(d) = max(0, 1 - |d - 1.5| / 2.5), per spec section 8 Step 3.
 */
function complementarySimilarity(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.max(0, 1 - Math.abs(d - 1.5) / 2.5);
}

function choiceSimilarity(a: string, b: string, mismatchPenalty: number): number {
  return a === b ? 1 : mismatchPenalty;
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const x of setA) if (setB.has(x)) intersection++;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 1 : intersection / union;
}

function questionSimilarity(
  q: QuestionDef,
  answerA: AnswerValue | undefined,
  answerB: AnswerValue | undefined,
  params: RoundParams,
): number | null {
  if (!answerA || !answerB) return null;

  if (q.type === "likert5") {
    const a = Number(answerA.value);
    const b = Number(answerB.value);
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    return q.scoring === "complementary" ? complementarySimilarity(a, b) : likertSimilarity(a, b);
  }

  if (q.type === "choice") {
    return choiceSimilarity(String(answerA.value), String(answerB.value), params.choiceMismatch);
  }

  if (q.type === "multiselect") {
    const a = Array.isArray(answerA.value) ? answerA.value : [];
    const b = Array.isArray(answerB.value) ? answerB.value : [];
    return jaccardSimilarity(a, b);
  }

  return null;
}

function answerMap(user: UserSnapshot): Map<string, AnswerValue> {
  const m = new Map<string, AnswerValue>();
  for (const a of user.answers) m.set(a.questionId, a);
  return m;
}

/**
 * A's satisfaction with B: weighted mean of per-question similarity, using
 * A's own importance weights (so A's preferences drive A's own satisfaction
 * score). Spec section 8 Step 3, S_{A->B}.
 */
export function oneWaySatisfaction(
  a: UserSnapshot,
  b: UserSnapshot,
  questions: QuestionDef[],
  params: RoundParams,
  mode: ModeKey,
): number {
  const aAnswers = answerMap(a);
  const bAnswers = answerMap(b);

  let weightedSum = 0;
  let weightTotal = 0;

  for (const q of questions) {
    if (q.modes && !q.modes.includes(mode)) continue;
    const answerA = aAnswers.get(q.id);
    const answerB = bAnswers.get(q.id);
    const w = questionWeight(a, q, answerA) * sectionMultiplier(a, q.section);
    if (w <= 0) continue;
    const sim = questionSimilarity(q, answerA, answerB, params);
    if (sim === null) continue;
    weightedSum += w * sim;
    weightTotal += w;
  }

  if (weightTotal === 0) return 0.5; // no comparable signal -> neutral
  return weightedSum / weightTotal;
}

/** Q_AB = sqrt(S_A->B * S_B->A) — the geometric mean, symmetric by construction. */
export function geometricMeanCompat(
  a: UserSnapshot,
  b: UserSnapshot,
  questions: QuestionDef[],
  params: RoundParams,
  mode: ModeKey,
): number {
  const sAB = oneWaySatisfaction(a, b, questions, params, mode);
  const sBA = oneWaySatisfaction(b, a, questions, params, mode);
  return Math.sqrt(Math.max(0, sAB) * Math.max(0, sBA));
}

function jaccardInterests(a: string[], b: string[]): number {
  return jaccardSimilarity(a, b);
}

/**
 * Final 0-100 score per spec section 8 Step 3:
 * score = 100 * (0.80*Q + 0.12*J(interests) + 0.08*[vibe match])
 */
export function pairScore(
  a: UserSnapshot,
  b: UserSnapshot,
  questions: QuestionDef[],
  params: RoundParams,
  mode: ModeKey,
): number {
  const q = geometricMeanCompat(a, b, questions, params, mode);
  const interestOverlap = jaccardInterests(a.interests, b.interests);
  const vibeMatch = a.promVibe === b.promVibe ? 1 : 0;
  const score = 100 * (0.8 * q + 0.12 * interestOverlap + 0.08 * vibeMatch);
  return Math.max(0, Math.min(100, score));
}

// ---------- Hard filters (spec section 8 Step 2) ----------

const ALL_GENDERS: GenderKey[] = ["WOMAN", "MAN", "NONBINARY", "SELF_DESCRIBE", "PREFER_NOT"];

/**
 * Date-mode gender compatibility, both directions. PREFER_NOT only matches
 * someone open to all genders (a seeker whose `seekingGenders` lists every
 * key), per spec section 8 Step 2.
 */
function genderCompatible(a: UserSnapshot, b: UserSnapshot): boolean {
  const aOpenToAll = ALL_GENDERS.every((g) => a.seekingGenders.includes(g));
  const bOpenToAll = ALL_GENDERS.every((g) => b.seekingGenders.includes(g));

  const aAccepts = b.gender === "PREFER_NOT" ? aOpenToAll : a.seekingGenders.includes(b.gender);
  const bAccepts = a.gender === "PREFER_NOT" ? bOpenToAll : b.seekingGenders.includes(a.gender);

  return aAccepts && bAccepts;
}

function yearCompatible(a: UserSnapshot, b: UserSnapshot): boolean {
  return (
    b.yearOfStudy >= a.yearMin &&
    b.yearOfStudy <= a.yearMax &&
    a.yearOfStudy >= b.yearMin &&
    a.yearOfStudy <= b.yearMax
  );
}

function departmentCompatible(a: UserSnapshot, b: UserSnapshot): boolean {
  if (a.department !== b.department) return true;
  return a.sameDeptOk && b.sameDeptOk;
}

function notBlockedOrExcluded(
  a: UserSnapshot,
  b: UserSnapshot,
  blockSet: Set<string>,
): boolean {
  if (blockSet.has(`${a.id}:${b.id}`) || blockSet.has(`${b.id}:${a.id}`)) return false;
  if (a.excludedEmailHashes.includes(b.ownEmailHash)) return false;
  if (b.excludedEmailHashes.includes(a.ownEmailHash)) return false;
  return true;
}

function notInHistory(a: UserSnapshot, b: UserSnapshot, mode: ModeKey, historySet: Set<string>): boolean {
  return !historySet.has(`${a.id}:${b.id}:${mode}`) && !historySet.has(`${b.id}:${a.id}:${mode}`);
}

function dealbreakersOk(a: UserSnapshot, b: UserSnapshot, questions: QuestionDef[]): boolean {
  const bAnswers = answerMap(b);
  const aAnswers = answerMap(a);
  const questionsByKey = new Map(questions.map((q) => [q.key, q] as const));

  for (const [key, disallowed] of Object.entries(a.dealbreakers)) {
    const q = questionsByKey.get(key);
    if (!q) continue;
    const bAns = bAnswers.get(q.id);
    if (!bAns) continue;
    const value = bAns.value;
    const values = Array.isArray(value) ? value : [value];
    if (values.some((v) => disallowed.includes(v as string | number))) return false;
  }
  for (const [key, disallowed] of Object.entries(b.dealbreakers)) {
    const q = questionsByKey.get(key);
    if (!q) continue;
    const aAns = aAnswers.get(q.id);
    if (!aAns) continue;
    const value = aAns.value;
    const values = Array.isArray(value) ? value : [value];
    if (values.some((v) => disallowed.includes(v as string | number))) return false;
  }
  return true;
}

export function squadSizeRangesOverlap(a: UserSnapshot, b: UserSnapshot): boolean {
  return a.squadSizeMin <= b.squadSizeMax && b.squadSizeMin <= a.squadSizeMax;
}

export interface HardFilterContext {
  blockSet: Set<string>;
  historySet: Set<string>;
  questions: QuestionDef[];
  mode: ModeKey;
}

/** Returns true if the pair survives every hard filter in spec section 8 Step 2. */
export function passesHardFilters(a: UserSnapshot, b: UserSnapshot, ctx: HardFilterContext): boolean {
  if (ctx.mode === "DATE" && !genderCompatible(a, b)) return false;
  if (!yearCompatible(a, b)) return false;
  if (!departmentCompatible(a, b)) return false;
  if (!notBlockedOrExcluded(a, b, ctx.blockSet)) return false;
  if (!notInHistory(a, b, ctx.mode, ctx.historySet)) return false;
  if (!dealbreakersOk(a, b, ctx.questions)) return false;
  if (ctx.mode === "SQUAD" && !squadSizeRangesOverlap(a, b)) return false;
  return true;
}
