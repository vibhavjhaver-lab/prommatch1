/**
 * Starter moderation blocklist. See DECISIONS.md, "Moderation blocklist",
 * for why this agent seeded a small, clearly-labelled starter list rather
 * than compiling an exhaustive multilingual slur list itself.
 *
 * Organizers (or a future session, with a human reviewing the additions)
 * should extend `BLOCK_PATTERNS` with a fuller list before a real launch.
 * Each entry: a regex (case-insensitive, leetspeak-normalised input — see
 * filter.ts) and the severity it triggers.
 */

export type Severity = "block" | "flag";

export interface BlockPattern {
  pattern: RegExp;
  severity: Severity;
  category: string;
}

export const BLOCK_PATTERNS: BlockPattern[] = [
  // Sexual content / explicit solicitation
  { pattern: /\bnudes?\b/i, severity: "block", category: "sexual-content" },
  { pattern: /\bsend\s*n[uo0]des?\b/i, severity: "block", category: "sexual-content" },

  // Threats
  { pattern: /\bi(?:'ll| will)?\s*kill\s*(?:you|u)\b/i, severity: "block", category: "threat" },
  { pattern: /\bi\s*know\s*where\s*you\s*live\b/i, severity: "block", category: "threat" },

  // Doxxing patterns: a full 10-digit phone number, or a line that reads
  // like a home address, inside a bio (handled contextually in filter.ts —
  // this pattern alone just flags for review since phone numbers also
  // appear in innocuous contexts like "call me after 10" false positives).
  { pattern: /\b\d{10}\b/, severity: "flag", category: "possible-phone-number" },
  { pattern: /\b(house|flat|room)\s*(no\.?|number)?\s*\d+[,.]?\s*(street|road|lane|block)\b/i, severity: "flag", category: "possible-address" },

  // Common English profanity (mild list; expand as needed) — flagged, not
  // auto-blocked, since mild swearing alone isn't a safety issue.
  { pattern: /\bf+u+c+k+/i, severity: "flag", category: "profanity" },
  { pattern: /\bb+i+t+c+h+/i, severity: "flag", category: "profanity" },

  // Harassment phrasing
  { pattern: /\bkill\s*yourself\b/i, severity: "block", category: "harassment" },
  { pattern: /\bkys\b/i, severity: "block", category: "harassment" },
  { pattern: /\byou'?re\s*(worthless|disgusting|pathetic)\b/i, severity: "flag", category: "harassment" },
];
