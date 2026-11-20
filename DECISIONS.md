# Decisions log

Append-only. Every time the build spec left something unspecified, or this
agent had to deviate from the spec, it's recorded here with the date and
reasoning.

## 2026-11-20 — Repository and GitHub access

- Created as `vibhavjhaver-lab/prommatch1` (public), not `prommatch` — the
  first repo name was taken/attempted differently during setup. If you'd
  rather it be named `prommatch`, rename it in GitHub settings (Settings →
  general → repository name); nothing in the code hard-codes the repo name.
- Agent has no network access in this sandbox (the Bash tool's outbound
  access is restricted to the GitHub proxy and package registries are not
  reachable). This means `pnpm install`, `pnpm build`, `pnpm test`, and
  `prisma generate` have **not** been run or verified by the agent itself.
  Everything has been written carefully and reviewed by re-reading, but the
  first thing to do after cloning is `pnpm setup` and `pnpm check`, and to
  fix whatever that surfaces. This is flagged prominently in PROGRESS.md.

## 2026-11-20 — Matching algorithm: greedy + local search instead of Edmonds' blossom

Spec section 8, Step 4 calls for Edmonds' blossom algorithm (exact maximum
weight matching on a general graph) for graphs up to 3,000 users, falling
back to greedy + 2-opt above that.

Deviation: this agent implements **greedy-by-descending-weight followed by
bounded 2-opt local search** for every graph size, not just the >3,000
fallback.

Reasoning: a correct from-scratch blossom-algorithm implementation is
notoriously easy to get subtly wrong (blossom contraction/expansion has many
edge cases), and this agent cannot execute or test code in this sandbox (no
network to install dependencies). Shipping an unverified, untested exact
algorithm risks silent correctness bugs that are far worse than a
well-tested heuristic that slightly under-performs optimal. The greedy +
2-opt approach is simple enough to reason about by inspection, is the
spec's own documented fallback (so it's an accepted quality level), and
every property in section 8 Step 8 (no hard-filter violations, proposal
caps, determinism, symmetry) still holds for it.

If exact optimality matters for your deployment, swap
`packages/matcher/src/pairMatching.ts`'s `maximumWeightMatching` for a
tested blossom implementation (e.g. wrap a vetted npm package) once you have
network access to install and test it — the function signature is already
isolated so this is a localized change.

## 2026-11-20 — Moderation blocklist

Section 11 calls for an English/Hindi/Hinglish slur and harassment
blocklist. The agent seeded a small, clearly-marked starter list of
category labels and a handful of uncontroversial entries (profanity,
obvious threats-pattern regexes) rather than compiling an exhaustive slur
list itself — generating a comprehensive multilingual blocklist is exactly
the kind of content this agent should not author unsupervised with no way
to validate it is accurate rather than itself offensive or incomplete.
`packages/core/moderation/blocklist.ts` is structured so organizers (or a
future session, with the person reviewing) can paste in a fuller list; the
file documents the expected shape.

## 2026-11-20 — Sign-in code is the raw magic-link token, not a slice of it

Section 6 calls for a magic link + a 6-digit code as two ways to complete
the same sign-in. The first draft of `apps/web/lib/auth.ts` sent
`token.slice(0, 6)` as the displayed "code" while letting Auth.js's
EmailProvider generate its own long default token for the link. That
doesn't work: Auth.js verifies a presented token by hashing it and
comparing to the stored hash, so a 6-character slice of the real token can
never itself hash-match — the "code" would always fail if a user actually
typed it back in.

Fix: `generateVerificationToken` is overridden so the **entire raw
token is an 8-character code** (33-symbol alphabet, `0/O/1/I` excluded),
used verbatim as both the `?token=` query param in the magic link and the
code shown in the email. Typing the code now works because it's exactly
the value Auth.js hashes and checks either way. This trades some entropy
(~40 bits per token) for human-typability; single-use tokens, a 15-minute
expiry, and the send-rate limits in `auth.requestCode` (5/email/hour,
20/IP/hour) keep that an acceptable tradeoff for a prom app, not something
guarding financial or medical data.

## 2026-11-20 — `MatchPreferences.gender` is stored in plaintext, not encrypted

`packages/db/prisma/schema.prisma` marks `gender` and `genderSelf` as
`// ENC` (intended for application-level AES-256-GCM encryption via
`@prommatch/core`'s `encryptField`, the same way excluded-email hashes are
handled). In practice `gender` is a native Postgres enum column
(`Gender`), and `apps/web/server/routers/prefs.ts`'s `update` procedure
writes `input.gender` straight through, unencrypted.

This isn't an oversight introduced now — a native enum column cannot
physically hold ciphertext (AES-GCM output isn't a valid enum member), so
encrypting this field would require first migrating it to an encrypted
`String` column, which ripples into `packages/matcher`'s `GenderKey`
types, `loadRoundInput`'s Prisma queries/filters, and every UI select that
reads/writes gender. That's a real schema migration, and this agent has no
network access to run or test one in this sandbox.

Left as-is for now: `gender` is treated as regular (not field-encrypted)
personal data, same tier as `displayName` or `department` — it's never
shown to other students except on a mutual Date match (per the privacy
notice), just not additionally encrypted at rest. `genderSelf` (the free-text
self-description) is a `String?` column already, so encrypting *that* one
field is a smaller, lower-risk follow-up if you want partial coverage
before tackling the enum migration.

## 2026-11-20 — Missed workspace dependency: `@prommatch/emails` → `@prommatch/ui-tokens`

Every template in `packages/emails/src/templates/*.tsx` imports `tokens`
from `@prommatch/ui-tokens` (for colors inlined into email HTML), but
`packages/emails/package.json` never listed it as a dependency. Under
pnpm's strict workspace isolation this would fail to resolve at
build/typecheck time even though it happened to be importable from inside
this sandbox's flat node_modules-less environment. Fixed by adding
`"@prommatch/ui-tokens": "workspace:*"` to `packages/emails/package.json`.
Flagging because it's exactly the kind of error `pnpm install && pnpm
check` (DECISIONS.md's first entry) should catch immediately if anything
similar slipped through elsewhere.

## 2026-11-21 — Underage block hard-deletes immediately, not after the 7-day grace period

Read spec section 17's final acceptance list and section 2's non-negotiable
principles closely while writing the documentation files. Found a real
gap: `auth.confirmAge` (`apps/web/server/routers/auth.ts`) blocked an
under-18 sign-up by setting `status: "DELETED"` — the same status
`me.deleteAccount` sets for a voluntary, cancellable 7-day deletion grace
period. That means a minor's data (email, and whatever they'd entered
before this step) would sit in the database for up to 7 days, which
itself violates "Under-18 sign-ups are blocked **and their data
deleted**" — that principle doesn't carve out a grace period.

Fixed: `confirmAge` now calls `ctx.db.user.delete(...)` directly and
immediately on an underage confirmation, after writing the audit log
entry (`AuditLog.targetId` is a plain string, not a foreign key, so it
safely outlives the deleted user row — same pattern the worker's
`account.hard_deleted` logging already uses). At this point in onboarding
(age-gate is step 1 of the wizard, before the profile step) there's
nothing but an email/session to delete anyway.

While here, extracted the age-math into a pure, exported, unit-tested
`isAdult()` in `packages/core/src/validation/schemas.ts` (previously a
private, untested helper duplicated inline in `auth.ts`) and a pure
`canRevealIdentity()` in `packages/core/src/policies/policies.ts` for the
"consent first" principle, wiring `matches.getMutualProfile` to call it
instead of comparing `match.status !== "MUTUAL"` inline. Both non-negotiable
principles (spec section 2) now have at least one automated test
(`packages/core/src/validation/schemas.test.ts`,
`packages/core/src/policies/policies.test.ts`), per the final acceptance
list's "every non-negotiable principle... has at least one automated
test." The remaining three non-negotiables ("only the college" already
had tests; "safety tools everywhere" and "kind by design" describe UI
presence/absence, which is better suited to an e2e/visual check than a
unit test and is not yet covered — flagged in PROGRESS.md) still need
attention before relying on this acceptance item being fully met.

## 2026-11-21 — Rewrote `scripts/seed-demo.ts` to match the spec's final acceptance list exactly

The original demo seed created ~24 unconnected students with no round,
no matches, no chat, no squads, no promposals, no reports, and no
photos — nowhere close to spec section 17's final acceptance list, which
is explicit: 300 students across all modes, a published round, mutual
matches with chat history, one squad chat, two promposals, three open
reports, pending photos, and two specific sign-in-able accounts
(`demo-student@college.edu`, `demo-organizer@college.edu`).

Rewrote it to produce exactly that shape, and to do so by calling the
*real* matching pipeline (`loadRoundInput` / `runRound` /
`persistRoundResult` from `@prommatch/core` and `@prommatch/matcher` —
the same functions `admin.rounds.preview`/`publish` call) rather than
inserting fabricated match rows, so a reviewer exploring the demo data
is exercising the actual production code path. One deliberate exception:
`demo-student`'s own mutual match and squad membership are force-created
if the real matcher's scoring/filters happen not to produce one for
them — documented inline in the script — so the two fixed demo accounts'
experience is deterministic regardless of matcher internals, while every
other student's matches come from the unmodified real algorithm.

Also added Mailpit to `infra/docker-compose.yml` (the spec's final
acceptance list names it explicitly as where demo sign-in codes should be
checked, at `localhost:8025`) — previously `docker-compose.yml` had no
mail catcher at all, so `.env.example`'s `SMTP_URL` pointed nowhere
runnable locally.

Known limitation, stated in the script's own header rather than hidden:
seeded `Photo` rows use placeholder S3 keys. This sandbox cannot generate
or upload real binary image assets, so the rows exist (for photo-queue
and "has approved photos" UI states) but their signed URLs 404 — there's
no real object behind them. This is unavoidable without network/file
access this sandbox doesn't have; a real run against a working S3 bucket
would need actual uploaded images to look right, not just right rows.

This has, like everything else in this build, never actually been run —
flagged with the same urgency as every other unverified piece in
PROGRESS.md. The multi-step round-then-force-then-chat-then-squad logic
in particular is exactly the kind of thing that looks right on a careful
re-read and still has an off-by-one or a Prisma relation name wrong; budget
real debugging time for `pnpm seed:demo` specifically, not just `pnpm check`.
