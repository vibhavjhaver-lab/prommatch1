# Launch Checklist

This codebase has **never been run** — no `pnpm install`, no build, no
test, no live database — because the sandbox that built it has no
network access beyond GitHub and package registries. Treat everything
below as mandatory, in order, not optional polish. See
[PROGRESS.md](./PROGRESS.md) for the full list of what's unverified
and why.

## 1. Make it actually run (local)

- [ ] `pnpm setup` — installs dependencies, copies `.env.example` →
  `.env`, generates the Prisma client. **This is the first time
  `pnpm install` will have ever been run against this repo.** Fix
  whatever it surfaces (version mismatches, a missing peer dep,
  a typo in a `package.json`) before doing anything else.
- [ ] Fill in every value `.env.example` documents. Pay particular
  attention to the ones it calls out as needing to match
  byte-for-byte across `apps/web`, `apps/worker`, and `apps/realtime`
  (`NEXTAUTH_SECRET`, `REDIS_URL`, `EMAIL_HASH_SALT`) — a mismatch
  here fails silently in ways that look like unrelated bugs
  (sessions that don't verify, jobs that never fire, email-domain
  checks that never match).
- [ ] `docker compose -f infra/docker-compose.yml up -d`, then
  `pnpm db:migrate:dev`. Confirm the seed (`packages/db/prisma/seed.ts`)
  actually ran — it creates the default `EventConfig` and the
  question bank; nothing works without it.
- [ ] `pnpm check` (lint + typecheck + test + build, every package).
  **This has never passed or failed — it has never run.** Expect to
  spend real time here. `packages/matcher` has the most unit-test
  coverage relative to its size; `apps/web` is the largest surface
  and the least exercised.
- [ ] `pnpm dev:all`, then walk the student flow yourself end to end:
  sign in with a seeded demo account (`pnpm seed:demo` first), finish
  onboarding, check that a photo you upload lands in `/admin/photos`
  as pending, approve it, create+preview+publish a round from
  `/admin/rounds`, confirm a notification arrives, open the chat for
  a mutual match and confirm a message sent from one browser tab
  shows up live in another (this exercises `apps/realtime`, which is
  the least-tested path in the whole system).

## 2. Make it run for real (hosting)

- [ ] Pick one of `render.yaml` / `fly.*.toml` / `railway.json` — they
  all describe the same three services (web, worker, realtime) plus
  managed Postgres/Redis, but **none of them has been deployed or
  tested**. Expect to debug the first deploy.
- [ ] Point DNS/`APP_URL` at the real domain and update
  `NEXTAUTH_URL` / CORS origins accordingly (`apps/realtime`'s CORS
  check and Auth.js's own callback URL both need to agree with
  whatever's in the browser's address bar, or sign-in and/or chat
  will silently fail).
- [ ] Set up real outbound email (the `SMTP_URL` var) — sign-in is
  completely blocked without working email delivery, since there's
  no password fallback.
- [ ] Point `S3_*` vars at a real S3-compatible bucket (not the local
  MinIO container) and confirm the bucket is **private** — photos and
  data exports are meant to be reachable only via signed URLs. A
  docker-compose line that would have made the bucket public was
  caught and removed during the build (see DECISIONS.md); double
  check your production bucket's policy directly rather than trusting
  that nothing else does this.
- [ ] Set the cron secret (`CRON_SECRET`) and actually schedule a
  periodic hit to `/api/cron/tick` (every 5–15 minutes is reasonable)
  on whatever your host uses for scheduled jobs — nothing calls this
  endpoint on its own. If you don't wire this up, auto-publish
  rounds, reminders, chat auto-close, and the data-retention wipe
  **never fire**, no matter what `/admin/config` says.
- [ ] `pnpm smoke` against the deployed URLs before telling anyone
  it's live.
- [ ] `pnpm restore:check` against your actual backup mechanism —
  confirm you can restore a backup *before* you need to, not after.

## 3. Before students start onboarding

- [ ] `/admin/config`: confirm the allowed email domain(s), the modes
  you're running, and the Match Drop dates are all correct — students
  will read the generated FAQ/landing copy based on this.
- [ ] `/admin/questions`: review the seeded question bank; edit or
  add anything specific to your event.
- [ ] Decide and set `autoPublishRounds` deliberately (see
  ADMIN_GUIDE.md) — don't leave this as whatever the seed defaulted
  to without checking.
- [ ] Review `packages/core/moderation/blocklist.ts` yourself and
  expand it. The agent that built this deliberately seeded only a
  small, clearly-marked starter list rather than writing a
  comprehensive multilingual slur/harassment list unsupervised — see
  DECISIONS.md. **This is a real gap, not a formality**: ship with
  the starter list and you will under-moderate.
- [ ] Read `apps/web/app/(public)/privacy/page.tsx` and
  `.../conduct/page.tsx` yourself and confirm the generated copy
  actually matches what you're prepared to stand behind, legally and
  in tone — it was generated from `packages/config`'s copy functions,
  not reviewed by a human yet.
- [ ] Decide who your first `SUPERADMIN` is and set it directly in the
  database (there's no self-serve path to the first superadmin, by
  design — see `scripts/setup.ts`).

## 4. Day of first Match Drop

- [ ] Be at a computer with `/admin/rounds` open when a drop date
  hits, at least for the first drop, even if `autoPublishRounds` is
  on — confirm it actually fired (`/admin/audit` should show
  `round.published`) rather than assuming.
- [ ] Watch `/admin/photos` and `/admin/reports` proactively in the
  hours after a drop — this is when volume spikes.

## 5. After the event

- [ ] Use `/admin/data` to export whatever you need (aggregate stats
  and/or the full per-event dump) **before** scheduling the
  retention wipe — the wipe is irreversible once its 48-hour delay
  elapses, with no undo.
- [ ] Schedule the wipe once you're sure you have everything you
  need, per your institution's data-retention commitments.
