import type { AnswerValue, MatchReason, ModeKey, QuestionDef, UserSnapshot } from "./types.js";

/**
 * Human-readable reason templates per question key. Keep these warm and
 * specific; never reference gender, preferences, dealbreakers, or the
 * substance question (spec section 8 Step 6).
 */
const REASON_TEMPLATES: Record<string, string> = {
  night_energy: "You both have the same idea of a great prom night",
  dance_floor: "You both want about the same amount of time on the dance floor",
  photos: "You're on the same page about prom photos",
  afterparty: "You'd both pick the same after-prom plan",
  humour: "You share the same sense of humour",
  weekend: "You both unwind the same way on weekends",
  movies: "You'd pick the same movie for movie night",
  commitment: "You're both looking for the same kind of thing from prom",
  values_kind: "You both put kindness high on the list",
  conversation: "You like talking about the same kinds of things",
  texting: "Your texting styles line up",
  planner: "One of you plans, the other goes with the flow — a good balance",
  initiator: "You balance each other out in conversation",
};

const BANNED_REASON_KEYS = new Set(["gender", "substance", "dealbreakers"]);

function answerMap(user: UserSnapshot): Map<string, AnswerValue> {
  const m = new Map<string, AnswerValue>();
  for (const a of user.answers) m.set(a.questionId, a);
  return m;
}

/**
 * Picks up to 3 reasons: questions where both answered within 1 point and
 * both gave importance >= 2, plus shared interests. Spec section 8 Step 6.
 */
export function buildReasons(
  a: UserSnapshot,
  b: UserSnapshot,
  questions: QuestionDef[],
  mode: ModeKey,
): MatchReason[] {
  const aAnswers = answerMap(a);
  const bAnswers = answerMap(b);
  const reasons: MatchReason[] = [];

  const candidates: { contribution: number; text: string }[] = [];

  for (const q of questions) {
    if (BANNED_REASON_KEYS.has(q.key)) continue;
    if (q.modes && !q.modes.includes(mode)) continue;
    const template = REASON_TEMPLATES[q.key];
    if (!template) continue;

    const answerA = aAnswers.get(q.id);
    const answerB = bAnswers.get(q.id);
    if (!answerA || !answerB) continue;
    if (answerA.importance < 2 || answerB.importance < 2) continue;

    if (q.type === "likert5") {
      const va = Number(answerA.value);
      const vb = Number(answerB.value);
      if (Number.isNaN(va) || Number.isNaN(vb)) continue;
      if (Math.abs(va - vb) > 1) continue;
      candidates.push({ contribution: answerA.importance + answerB.importance, text: template });
    } else if (q.type === "choice") {
      if (answerA.value !== answerB.value) continue;
      candidates.push({ contribution: answerA.importance + answerB.importance, text: template });
    }
  }

  candidates.sort((x, y) => y.contribution - x.contribution);
  for (const c of candidates.slice(0, 2)) reasons.push({ text: c.text });

  const sharedInterests = a.interests.filter((i) => b.interests.includes(i));
  if (sharedInterests.length > 0 && reasons.length < 3) {
    const top = sharedInterests.slice(0, 2).join(" and ");
    reasons.push({ text: `You're both into ${top}` });
  }

  return reasons.slice(0, 3);
}
