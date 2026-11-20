# Progress

This file is the honest status report. It was written by the same
agent that built the codebase, autonomously, with no human review of
any individual piece along the way — read it before trusting anything
here under real event pressure.

## The one fact that governs everything else

**This codebase has never been executed.** The sandbox this was built
in has outbound network access only to GitHub and package registries
— no access to install from scratch with a working lockfile check,
no database, no Redis, no browser. `pnpm install`, `pnpm build`,
`pnpm test`, `prisma generate`, and `prisma migrate` have never once
actually run. Every file was written carefully, cross-checked by
re-reading related files (e.g. checking that a router's Zod input
matches the Prisma schema it writes to), and a reasonable number of
bugs were caught that way (see DECISIONS.md and section "Bugs found
and fixed" below) — but "I re-read it carefully" is not the same
guarantee as "it ran." Budget real time for [LAUNCH.md](./LAUNCH.md)
step 1 before anything else.

## What's built (all 18 spec sections have a corresponding implementation)

- **Auth**: passwordless, college-email-domain-gated, magic link +
  typed code (same underlying token, see DECISIONS.md), rate-limited.
- **Onboarding**: age-gate → profile → photos → questionnaire →
  preferences → review, each step persisted individually.
- **Matching**: deterministic seeded matcher for Date/Friend/Squad
  modes, hard filters + soft scoring, greedy+2-opt pairing (documented
  deviation from spec's exact-algorithm request — see DECISIONS.md),
  admin preview before publish, manual or auto-publish on schedule.
- **Matches/chat**: mutual-match gating (full profile only revealed
  after both sides accept), text chat with Socket.IO live delivery +
  polling fallback, blocking, reporting.
- **Squads**: group formation and the group-equivalent of the above.
- **Promposals**: a lighter-weight "ask someone to prom" flow separate
  from the matching system.
- **Notifications**: push (web-push/VAPID) + email (React Email
  templates), in-app notification list, per-user granular opt-outs.
- **Admin console**: all 12 sections (stats, config, questions,
  rounds, photos, reports, users, announcements, audit, data,
  organizers) — see [ADMIN_GUIDE.md](./ADMIN_GUIDE.md).
- **Background jobs**: all 12 job types running on one BullMQ worker —
  scheduled round auto-publish, decision-window expiry, reminders
  (decision + onboarding), announcements fan-out, chat auto-close,
  account deletion after grace period, full event retention wipe,
  personal/event data export, organizer digest, push/email delivery.
- **Privacy/moderation**: policy-based authorization on every
  procedure, audit logging on sensitive mutations, a starter
  moderation blocklist (deliberately not comprehensive — see below),
  AES-256-GCM field encryption utility (used for the fields where it
  was structurally possible — see the gender-field gap below),
  7-day account-deletion grace period, scheduled 48-hour-delayed
  full event wipe.
- **Infra**: Docker multi-stage builds for all three apps, three
  alternative hosting configs (Render/Fly/Railway), GitHub Actions
  CI, operational scripts (setup, demo seed, secret generation, smoke
  test, restore-check), `.env.example`.
- **Docs**: this file, README.md, ADMIN_GUIDE.md, LAUNCH.md,
  DECISIONS.md.

## Explicitly out of scope / deliberately incomplete

These are not oversights — each was a conscious call, reasoned through
in DECISIONS.md, driven by the no-execution constraint:

1. **Matching algorithm is greedy + 2-opt everywhere**, not Edmonds'
   blossom for small graphs as the spec's happy path describes. An
   untested from-scratch blossom implementation was judged riskier
   than the spec's own documented large-graph fallback. All of the
   spec's correctness *properties* (no hard-filter violations,
   proposal caps, determinism, symmetry) hold either way; what you
   lose is a guarantee of *globally optimal* total score, not
   correctness.
2. **Moderation blocklist is a small starter list**, not the
   comprehensive multilingual slur/harassment list the spec calls
   for. Generating that unsupervised, with no way to validate it was
   accurate rather than itself offensive or incomplete, was judged
   out of bounds for autonomous execution. **Action required**:
   organizers must expand `packages/core/moderation/blocklist.ts`
   before relying on automated moderation (manual review via
   `/admin/reports` still works regardless).
3. **`MatchPreferences.gender` is not field-encrypted**, despite an
   old schema comment suggesting it should be — it's a native
   Postgres enum column, which cannot physically hold ciphertext.
   Fixing this is a real migration (enum → encrypted string column,
   touching the matcher's types and every gender `<select>`), left
   undone because it can't be tested here. `genderSelf` (free text)
   *is* a plain `String?` column and is a smaller candidate for the
   same treatment later.
4. **Playwright coverage is smoke-level only** (`e2e/public-pages.spec.ts`):
   the unauthenticated public pages and a sign-in validation check.
   Onboarding, matching, and chat flows need a seeded, signed-in
   session to test, which needs a running database — deferred to
   whoever runs this with real infrastructure. The CI workflow's
   `e2e` job is stubbed with `if: false` for the same reason; flip it
   on once there's a seed-and-run-e2e step that works in CI.
5. **No load/performance testing of any kind.** The matcher's
   complexity, the realtime server's connection handling under many
   concurrent users, and query performance at scale are all
   un-benchmarked.

## Bugs found and fixed during the build (self-caught, not user-reported)

All logged with full detail in DECISIONS.md; summary:

- Sign-in code and magic-link token didn't actually match (code was a
  slice of a token Auth.js verifies by full hash — fixed by making the
  whole token a typeable 8-char code).
- `/api/upload/complete`'s ownership check referenced a key prefix
  (`uploads/<id>/raw/`) that the upload-URL generator never produces —
  would have rejected every legitimate upload confirmation.
- `admin.data.exportFull` wrote an audit log but never enqueued the
  actual export job.
- `admin.data.wipeEvent` computed a schedule time but never persisted
  it anywhere a worker could read it later; `cancelWipe`/`wipeStatus`
  were missing entirely.
- `notify()` only ever sent push notifications; three email templates
  existed but were never wired up to send.
- Publishing a round (both the manual admin action and the
  auto-publish job) never actually told affected students a new drop
  was out.
- `packages/emails`'s `package.json` was missing a dependency
  (`@prommatch/ui-tokens`) that every one of its templates imports —
  would fail to resolve under pnpm's strict workspace isolation.
- A draft docker-compose line would have made the photo/export S3
  bucket publicly readable, defeating the signed-URL-only privacy
  model — caught and removed before being committed.
- `(app)/layout.tsx` redirected away even a user in the 7-day
  account-deletion grace period, which would have made
  `me.cancelDeletion` unreachable from the one place a user could use
  it.

The pattern across all of these: things that are wrong in a way that
only shows up when you actually run the code end-to-end (a route
that's never hit by anything else, a job that's enqueued but never
consumed, a dependency that resolves by accident in a flat
node_modules but wouldn't in a strict one). This is exactly the
category of bug [LAUNCH.md](./LAUNCH.md) step 1 (`pnpm check` +
walking the flows by hand) is meant to catch more of.

## Recommended order if you're picking this up

1. [LAUNCH.md](./LAUNCH.md) section 1 — get it running locally, fix
   what breaks.
2. Skim DECISIONS.md — know what's been deliberately deferred so you
   don't rediscover it the hard way.
3. Expand the moderation blocklist (gap #2 above) before any real
   students touch it.
4. [LAUNCH.md](./LAUNCH.md) sections 2–3 — deploy, configure the
   event, review the generated legal/conduct copy yourself.
5. [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) for how to actually run a
   Match Drop day-to-day.
