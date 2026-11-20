# PromMatch

A college prom matchmaking app: students answer a short questionnaire and
set preferences, an automated matcher proposes Date/Friend/Squad matches
in scheduled "Match Drops," and matches only become visible to each other
once both sides say yes.

**Before you do anything else, read [PROGRESS.md](./PROGRESS.md).** This
repository was built autonomously, in a sandbox with no network access —
`pnpm install` has never actually been run against it, and neither has
any test. PROGRESS.md is the honest account of what that means for you.
[DECISIONS.md](./DECISIONS.md) is the append-only log of every place the
build spec was ambiguous or had to be deviated from, with reasoning.

## Stack

- **Monorepo**: pnpm workspaces + Turborepo, TypeScript strict mode
- **apps/web**: Next.js 15 (App Router), tRPC v11, Auth.js v5 (passwordless, college-email-only), Prisma/PostgreSQL, Tailwind
- **apps/worker**: BullMQ (Redis-backed) job processors — scheduled rounds, reminders, notifications, exports, data retention
- **apps/realtime**: Socket.IO server for live chat delivery
- **packages/matcher**: the pure matching engine (no DB dependency, fully unit-testable) — scoring, pair matching, squad matching
- **packages/config, core, db, emails, ui-tokens**: shared event configuration, policies/crypto/moderation, Prisma schema, email templates, design tokens

## Quick start

```bash
pnpm setup              # copies .env.example → .env, installs deps, generates the Prisma client
# fill in .env — see the comments in .env.example for what each var is
docker compose -f infra/docker-compose.yml up -d   # local Postgres + Redis + MinIO
pnpm db:migrate:dev      # creates the schema and runs prisma/seed.ts (event config + question bank)
pnpm seed:demo           # optional: ~24 fake students with profiles/answers, dev only
pnpm dev:all             # runs apps/web, apps/worker, apps/realtime together
pnpm check               # lint + typecheck + test + build — run this before trusting anything
```

Sign in at `http://localhost:3000` with any `@college.edu`-style address
your `EventConfig.allowedEmailDomains` allows (the seeded default is
`demo.college.edu` — see `scripts/seed-demo.ts`). Check your local mail
catcher (e.g. [Mailpit](https://github.com/axllent/mailpit)) for the
sign-in code.

## Repo structure

```
apps/
  web/        Next.js app: student-facing pages, the admin console, the tRPC API
  worker/     BullMQ job processors
  realtime/   Socket.IO server for chat
packages/
  config/     EventConfig schema/defaults, the question bank, generated copy
  core/       authorization policies, crypto, moderation, validation schemas, the job queue, DB↔matcher glue
  db/         Prisma schema + client + the real (idempotent) seed
  matcher/    the matching engine — pure, no I/O
  emails/     React Email templates
  ui-tokens/  shared design tokens (CSS variables)
infra/        docker-compose.yml + a Dockerfile per app
scripts/      setup, demo seed, secret generation, smoke test, restore-check
e2e/          Playwright tests
```

## Day-to-day operation

See [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) for how organizers run questions,
Match Drops, photo review, reports, and event configuration from the
admin console. See [LAUNCH.md](./LAUNCH.md) before actually running this
for a real prom.

## Scripts reference

| Command | What it does |
|---|---|
| `pnpm setup` | First-run setup |
| `pnpm dev:all` / `dev:web` / `dev:worker` / `dev:realtime` | Run one or all apps locally |
| `pnpm check` | lint + typecheck + test + build, everywhere |
| `pnpm db:migrate:dev` / `db:migrate` | Apply migrations (dev / production) |
| `pnpm db:studio` | Prisma Studio |
| `pnpm seed:demo` | Dev-only demo data |
| `pnpm generate:secrets` | Prints fresh random values for the secret env vars |
| `pnpm smoke` | Post-deploy health check (DB, Redis, web, realtime) |
| `pnpm restore:check` | Backup/restore drill — run this before you actually need a backup to work |
| `pnpm test:e2e` | Playwright tests against a running apps/web |
