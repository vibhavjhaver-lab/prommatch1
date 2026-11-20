import type { EventConfig } from "./schema.js";

/**
 * Generated static copy (section 18-C). Functions take the live EventConfig
 * so copy stays correct after organizers edit dates, names, etc.
 */

export function landingCopy(cfg: EventConfig) {
  return {
    heroTitle: "Find your prom person.",
    heroSubtitle:
      "Answer a few fun questions. We'll suggest matches. Names stay hidden until you both say yes.",
    steps: [
      { title: "Sign up", body: `Sign up with your ${cfg.collegeName} email.` },
      { title: "Answer the vibe check", body: "A short questionnaire about you and what you want from prom night." },
      { title: "Get your Match Drop", body: "Review your matches and decide — only mutual yeses unlock names and chat." },
    ],
  };
}

export function faqCopy(cfg: EventConfig) {
  return [
    { q: "Who can join?", a: `Anyone at ${cfg.collegeName} with a verified college email, 18 or older.` },
    { q: "Is it only romantic?", a: "No — you can opt into Date matching, Friend matching, Squad matching, or all three." },
    { q: "Who sees my answers?", a: "Only the matcher. Your answers never appear on your profile or to other students." },
    { q: "What if I don't get a match?", a: "You'll be prioritised in the next Match Drop. There are usually several drops before prom." },
    { q: "Can I choose who I go with anyway?", a: "Yes — enter a friend code in Squad mode, or just go without using the app at all." },
    { q: "What if someone makes me uncomfortable?", a: "Report or block them from any profile, match card, or chat — it's one tap, and it's confidential." },
    { q: "Can I delete my data?", a: "Yes, any time, from Settings. Deletion is permanent after a short grace period." },
    { q: "How does scoring work?", a: "We compare your answers and how much each one matters to you, and suggest people whose answers tend to fit well with yours." },
    { q: "Is it free?", a: `Yes, ${cfg.appName} is free for every ${cfg.collegeName} student.` },
    { q: "Who runs this?", a: "A small group of student organizers, with the same safety rules applied to everyone, including them." },
  ];
}

export const codeOfConduct = [
  "Respect a pass. If someone doesn't accept a match, that's the end of it — no follow-up outside the app.",
  "No harassment, pressure, or repeated unwanted contact.",
  "No sharing someone else's messages, photos, or identity without their consent.",
  "No fake profiles or impersonation.",
  "You must be 18 or older to use this app.",
  "Report anything that concerns you — reports are confidential and reviewed by organizers.",
];

export const conductConsequences = [
  "First concern: a warning and a reminder of these rules.",
  "Repeated or serious concern: a temporary suspension.",
  "Severe or repeated violation: a permanent ban, decided by a superadmin.",
];

export function privacyNotice(cfg: EventConfig) {
  return {
    collects: [
      "Your college email, name/nickname, year, department",
      "Your questionnaire answers and stated preferences (used only for matching)",
      "Photos you upload (shown only after a mutual match, in Date mode)",
      "Messages you send in-app",
    ],
    why: "To run the matching, show you your matches, and let you chat with mutual matches.",
    whoSees: [
      { data: "Your answers and private preferences", who: "Only the automated matcher — never shown to other students or to organizers." },
      { data: "Your public profile fields", who: "Only people you have mutually matched with." },
      { data: "Your messages", who: "Only you and your match, unless a report requires an organizer to review the surrounding messages." },
      { data: "Aggregate statistics", who: "Organizers, grouped so no individual is identifiable." },
    ],
    retention: `We delete your personal data ${cfg.dates.dataRetentionDaysAfterProm} days after prom, or sooner if you delete your account.`,
    rights: [
      "Access: download a copy of your data any time from Settings.",
      "Correct: edit your profile and answers any time (answers lock once the questionnaire closes).",
      "Delete: delete your account any time; deletion is permanent after a short grace period.",
    ],
    contact: cfg.superAdmins[0] ?? "organizer@college.edu",
  };
}

export const emptyStates = {
  noProposals: (nextDropDate: string) => `Your first Match Drop lands on ${nextDropDate}. We'll ping you.`,
  noChats: "No conversations yet. They'll show up here after a mutual match.",
  noSquad: "You haven't joined a squad yet. Opt into Squad mode in Settings to get started.",
  noReportsOrganizer: "All quiet. Nice.",
};
