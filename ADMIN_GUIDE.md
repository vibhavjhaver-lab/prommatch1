# Admin Guide

For the people running the event — `ORGANIZER` and `SUPERADMIN` roles.
Everything below lives at `/admin` once you're signed in with one of
those roles (`admin.organizers` lets a `SUPERADMIN` grant/revoke the
`ORGANIZER` role; the first superadmin is set directly in the database
— see `scripts/seed.ts` / `scripts/setup.ts`).

## Before the event opens

1. **`/admin/config` — Event configuration.** Set the event name, the
   allowed college email domain(s) (sign-up is hard-blocked outside
   this list), the matching modes you're running (Date / Friend /
   Squad — any subset), and the Match Drop dates. Dates and the
   headline copy can be changed later without redeploying; anything
   structural (e.g. turning Squad mode on mid-event) should be done
   here before students start onboarding, since the FAQ/landing copy
   is generated from this config and students will have already read
   the old version.
2. **`/admin/questions` — Question bank.** Review and edit the
   questionnaire students answer during onboarding. You can add,
   edit, reorder, and activate/deactivate questions; deactivating
   doesn't delete past answers, it just stops asking it going
   forward. The matcher only reads questions marked active at the
   time a round runs.
3. Decide whether `config.matching.autoPublishRounds` is on. If on,
   the worker's cron tick auto-generates and publishes each mode's
   round the moment its drop date passes — you don't have to be
   online. If off, you must manually preview and publish every round
   (step below) — the drop date passing does nothing by itself.

## Running a Match Drop (manual mode)

`/admin/rounds`:

1. **Create** a round for a given mode once its drop date is close
   (the round number is assigned automatically, in order, per mode).
2. **Preview** it. This runs the real matching algorithm against
   current data and shows you the proposed pairs/squads *without*
   writing anything or notifying anyone — safe to re-run as many
   times as you want, including right up until you're ready.
3. **Publish**. This is the point of no return for that round: results
   are written, every affected student gets a notification (push
   and/or email, depending on what they've enabled), and the round
   becomes visible in their Matches tab. There's no "unpublish" —
   if something is wrong, fix it for the *next* round rather than
   trying to retract this one, since by the time you've noticed,
   students may already have seen it.

If `autoPublishRounds` is on, the worker does steps 1–3 by itself when
a drop date passes; you'll see those rounds appear in `/admin/rounds`
already published. You can still watch `/admin/audit` for the
`round.published` entries to confirm it ran.

## Ongoing moderation

- **`/admin/photos`** — Every uploaded profile photo sits in `PENDING`
  until an organizer approves or rejects it; nothing is shown to other
  students, and no automated moderation runs, until you act on it.
  Check this regularly once students start onboarding — a backlog
  here directly blocks people from completing onboarding.
- **`/admin/reports`** — Student-submitted reports (on a profile, a
  message, or a promposal). Act on each one: no action, warn, suspend,
  or ban. A suspended/banned student is signed out of further activity
  immediately (checked in `(app)/layout.tsx` on every page load) but
  keeps their existing matches/conversations intact unless you also
  remove them from a round — this app does not auto-retract a match
  because one side was moderated; use judgment per report.
- **`/admin/users`** — Search any student by name/email, see their
  status, and change it directly (same enum as the reports flow:
  active/paused/suspended/banned). Useful for handling a situation
  that didn't come in through the report flow (e.g. someone emails you
  directly).

## Announcements

**`/admin/announcements`** sends a push+email blast to a chosen
audience: everyone, a specific matching mode's participants, students
with no match yet, students with a mutual match, or students who
confirmed "going together." Use this for logistics (ticket deadlines,
venue changes) rather than the per-round notifications, which are
scoped to match results only.

## Data: exports and the retention wipe

**`/admin/data`**:

- **Export (aggregate)** — anonymized, event-level statistics. Safe to
  share outside the organizer team.
- **Export (full)** — a complete per-user data dump of the event, for
  your own records or a requesting authority. This enqueues a
  background job; you'll get a download link once it's ready (check
  back, or watch for the notification).
- **Schedule data wipe** — type the confirmation phrase to schedule a
  full event wipe (every student's profile, photos, matches, chats,
  reports — everything except the `EventConfig` and `AuditLog`
  themselves) **48 hours from now**. This is the one truly
  destructive action in the admin console:
  - It is *scheduled*, not immediate, specifically so you have a
    48-hour window to change your mind.
  - **Cancel scheduled wipe** removes it — do this if you scheduled it
    by mistake or the event isn't actually over.
  - Once the 48 hours elapse, the worker's `dataRetentionWipe` job
    runs with no further confirmation and it is **not reversible** —
    there is no "undo," no soft-delete, no trash folder. Export
    whatever you need *before* the 48 hours run out, not after.
  - Run this only once the event is genuinely finished. It is meant
    for complying with a "don't retain student data past the event"
    policy, not for resetting the app between smaller test runs (for
    that, use a fresh database instead).

## If something looks wrong

- `/admin/audit` is the full trail of every admin and worker action
  that touches user data (who did what, when, to what). Start here
  when investigating "why did X happen."
- The worker and realtime services log to stdout wherever you've
  deployed them (see `render.yaml` / `fly.*.toml` / `railway.json` for
  where that is per host). A stuck round or missing notification is
  almost always a queue/worker problem, not a web-app problem — check
  there first.
- See [PROGRESS.md](./PROGRESS.md) for known gaps and things that
  have not been exercised end-to-end before you rely on them under
  real event pressure.
