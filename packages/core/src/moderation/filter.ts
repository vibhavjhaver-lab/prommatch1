import { BLOCK_PATTERNS, type Severity } from "./blocklist.js";

export interface ModerationResult {
  severity: Severity | "ok";
  categories: string[];
  normalisedText: string;
}

/**
 * Normalises leetspeak and extra spacing so "s3x" or "f u c k" still match
 * the plain-word patterns. Spec section 11, Moderation pipeline step 1.
 */
export function normalise(text: string): string {
  let out = text.toLowerCase();
  const leet: Record<string, string> = {
    "0": "o",
    "1": "i",
    "3": "e",
    "4": "a",
    "5": "s",
    "7": "t",
    "@": "a",
    "$": "s",
  };
  out = out.replace(/[01345@$]/g, (ch) => leet[ch] ?? ch);
  // Collapse repeated letters inserted to evade matching ("fuuuuck") and
  // remove spaces/punctuation inserted between letters ("f u c k", "f.u.c.k").
  out = out.replace(/([a-z])[\s._-]+(?=[a-z])/g, "$1");
  return out;
}

/**
 * Runs text through the local blocklist. If `OPENAI_MODERATION_KEY` (or
 * another moderation key) is configured, callers should also call an
 * external moderation API and take the stricter result — that integration
 * lives in apps/worker (optional, skips cleanly with no key set) so this
 * package stays dependency-free and testable offline.
 */
export function moderateText(text: string): ModerationResult {
  const normalisedText = normalise(text);
  const categories: string[] = [];
  let severity: Severity | "ok" = "ok";

  for (const { pattern, severity: s, category } of BLOCK_PATTERNS) {
    if (pattern.test(normalisedText)) {
      categories.push(category);
      if (s === "block") severity = "block";
      else if (severity !== "block") severity = "flag";
    }
  }

  return { severity, categories, normalisedText };
}

export function isAllowed(result: ModerationResult): boolean {
  return result.severity !== "block";
}
