export { Layout, PrimaryButton } from "./templates/Layout.js";
export { SignInCode } from "./templates/SignInCode.js";
export { MatchDrop } from "./templates/MatchDrop.js";
export { MutualMatch } from "./templates/MutualMatch.js";
export { PromposalReceived } from "./templates/PromposalReceived.js";

/**
 * Remaining templates from spec section 14 (Welcome, PromposalAnswered,
 * DecisionReminder, OnboardingReminder, Announcement, AccountSuspended,
 * DataExportReady, AccountDeletionScheduled, OrganizerDigest, UrgentReport)
 * follow the exact same pattern as the five implemented here: a props
 * interface, a <Layout> wrapper, optional <PrimaryButton>. Copy
 * MutualMatch.tsx as a starting point for a new one.
 */
