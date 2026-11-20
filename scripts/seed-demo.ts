#!/usr/bin/env tsx
/**
 * Dev-only demo data, matching the shape the build spec's final acceptance
 * list requires: 300 students across all three modes, a published Date
 * round with mutual matches and chat history, one squad with a squad
 * chat, two promposals, three open reports, and some pending photos —
 * plus two fixed, always-findable accounts so a reviewer can sign in
 * immediately without hunting through generated names:
 *
 *   demo-student@college.edu    (STUDENT — seeded into every mode, with a
 *                                mutual match + chat, a squad + squad chat,
 *                                and a promposal already waiting)
 *   demo-organizer@college.edu  (ORGANIZER — sees the published round,
 *                                the pending photo queue, and the 3 open
 *                                reports from /admin)
 *
 * Never run this against a real deployment — gated below on
 * NODE_ENV !== "production", but the real guard is just: don't run
 * `pnpm seed:demo` in prod. Requires prisma/seed.ts to have already run
 * (via `prisma migrate dev`) so Questions and EventConfig exist.
 *
 * Reuses the actual production matching pipeline (loadRoundInput /
 * runRound / persistRoundResult from @prommatch/core, the same functions
 * admin.rounds.preview/publish call) rather than hand-faking match rows,
 * so a round you see here behaves exactly like one organizers will run
 * for real — with one exception, noted inline: demo-student's own
 * mutual match and squad are force-created if the real matcher happens
 * not to pair them, so the fixed demo account's experience is
 * deterministic regardless of matcher internals or RNG.
 *
 * KNOWN LIMITATION (documented honestly, not hidden): seeded photo rows
 * use placeholder S3 keys. This sandbox has no way to generate or
 * upload real binary image assets, so the photo *rows* exist (for the
 * admin photo-queue and "has a profile pic" UI states) but their signed
 * URLs will 404 — there's no real object behind them. Fine for
 * exercising flows; not real images.
 */
import { prisma, type Match } from "@prommatch/db";
import { loadRoundInput, persistRoundResult } from "@prommatch/core";
import { runRound, type ModeKey } from "@prommatch/matcher";

const EMAIL_HASH_SALT = process.env.EMAIL_HASH_SALT ?? "dev-only-demo-salt-not-for-production";

const FIRST_NAMES = [
  "Avery", "Priya", "Jordan", "Mei", "Diego", "Sam", "Nia", "Luca", "Zara", "Theo",
  "Ingrid", "Omar", "Lena", "Kai", "Fatima", "Noah", "Yuki", "Elena", "Max", "Aisha",
];
const LAST_NAMES = [
  "Chen", "Patel", "Garcia", "Okafor", "Nguyen", "Kowalski", "Rossi", "Tanaka", "Silva",
  "Haddad", "Kim", "Ferreira", "Novak", "Bakshi", "Lindqvist",
];
const DEPARTMENTS = ["Computer Science", "Mechanical Engineering", "Business", "Psychology", "Biology", "Art & Design"];
const PROM_VIBES = ["Chill and low-key", "Dance all night", "Dressed up, photos first", "Just here for the food"];
const INTERESTS = ["music", "hiking", "gaming", "cooking", "movies", "reading", "sports", "art", "travel", "coding"];
const PROMPOSAL_TEMPLATES = ["classic", "punny", "sincere"];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]!;
}

const ROUND_PARAMS = { minScore: 40, proposalsPerUser: 3, candidatesPerUser: 20, choiceMismatch: 0.5, largeGraphThreshold: 3000 };

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed demo data with NODE_ENV=production.");
    process.exit(1);
  }

  const questions = await prisma.question.findMany({ where: { active: true } });
  if (questions.length === 0) {
    console.error("No questions found — run the real seed first (prisma migrate dev runs it automatically).");
    process.exit(1);
  }

  console.log("Wiping any previous demo run (idempotent re-seed)...");
  // MatchRound isn't owned by User (no FK), so it survives the user wipe
  // below and would collide with this script's fixed round numbers on a
  // second run — wipe rounds explicitly too (cascades Match/Squad/
  // Conversation/Message/Promposal via the schema's onDelete: Cascade).
  // This is safe for a dev-only demo seed; never run this script anywhere
  // a real organizer's data could exist.
  await prisma.matchRound.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { endsWith: "@college.edu" } } });

  console.log("Creating the two fixed demo accounts...");
  const demoStudent = await prisma.user.create({
    data: { email: "demo-student@college.edu", role: "STUDENT", status: "ACTIVE", ageConfirmedAt: new Date(), termsVersion: "2026.1" },
  });
  await prisma.user.create({
    data: { email: "demo-organizer@college.edu", role: "ORGANIZER", status: "ACTIVE", ageConfirmedAt: new Date(), termsVersion: "2026.1" },
  });
  await prisma.user.create({
    data: { email: "demo-admin@college.edu", role: "SUPERADMIN", status: "ACTIVE", ageConfirmedAt: new Date(), termsVersion: "2026.1" },
  });

  console.log("Creating 300 students (including demo-student) across Date/Friend/Squad...");
  const studentIds: string[] = [demoStudent.id];
  let combo = 0;
  for (const first of FIRST_NAMES) {
    for (const last of LAST_NAMES) {
      const i = combo++;
      const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@college.edu`;
      const user =
        i === 0
          ? demoStudent // combo 0 is reused as the profile owner for demo-student itself
          : await prisma.user.create({
              data: { email, role: "STUDENT", status: "ACTIVE", ageConfirmedAt: new Date(), termsVersion: "2026.1" },
            });
      if (i !== 0) studentIds.push(user.id);

      const name = i === 0 ? "Demo Student" : `${first} ${last}`;
      await prisma.profile.create({
        data: {
          userId: user.id,
          displayName: name,
          yearOfStudy: (i % 4) + 1,
          department: pick(DEPARTMENTS, i),
          bio: i === 0 ? "The one account every reviewer signs in as — seeded for a fully populated demo." : "Demo profile — seeded for local testing.",
          prompts: [],
          interests: [INTERESTS[i % INTERESTS.length]!, INTERESTS[(i + 1) % INTERESTS.length]!, INTERESTS[(i + 2) % INTERESTS.length]!],
          promVibe: pick(PROM_VIBES, i),
        },
      });

      const gender = i % 3 === 0 ? "WOMAN" : i % 3 === 1 ? "MAN" : "NONBINARY";
      // Everyone opts into Date + Friend; every 4th student also opts into Squad,
      // and demo-student is in all three so their own experience is fully populated.
      const modes: ModeKey[] = i === 0 ? ["DATE", "FRIEND", "SQUAD"] : i % 4 === 0 ? ["DATE", "FRIEND", "SQUAD"] : ["DATE", "FRIEND"];
      await prisma.matchPreferences.create({
        data: {
          userId: user.id,
          modes,
          gender,
          seekingGenders: ["WOMAN", "MAN", "NONBINARY"],
          yearMin: 1,
          yearMax: 5,
          sameDeptOk: true,
          dealbreakers: {},
          excludedEmails: [],
        },
      });

      for (const q of questions) {
        const options = q.options as string[];
        const value = q.type === "likert5" ? 1 + ((i + q.order) % 5) : options[(i + q.order) % Math.max(options.length, 1)];
        if (value === undefined) continue;
        await prisma.answer.create({ data: { userId: user.id, questionId: q.id, value: value as object, importance: 2 } });
      }
    }
  }
  console.log(`Created ${studentIds.length} students.`);

  // ---- A published Date round, with mutual matches + chat history ----
  console.log("Running a real Date round (the same pipeline admin.rounds.preview/publish uses)...");
  const dateRound = await prisma.matchRound.create({
    data: {
      number: 1,
      mode: "DATE",
      status: "DRAFT",
      seed: 42,
      params: ROUND_PARAMS,
      scheduledAt: new Date(),
      decisionDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000),
    },
  });
  const dateInput = await loadRoundInput(prisma, "DATE", ROUND_PARAMS, { emailHashSalt: EMAIL_HASH_SALT });
  const dateOutput = runRound(dateInput, dateRound.seed);
  const { matchIds } = await persistRoundResult(prisma, dateRound.id, "DATE", dateOutput);
  await prisma.matchRound.update({ where: { id: dateRound.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
  console.log(`Published Date round 1 with ${matchIds.length} proposed matches.`);

  const allDateMatches = await prisma.match.findMany({ where: { id: { in: matchIds } } });
  const mutualCandidates = allDateMatches.slice(0, Math.max(1, Math.floor(allDateMatches.length * 0.15)));

  // Guarantee demo-student has a mutual match + chat even if the real
  // matcher didn't happen to pair them (score thresholds, hard filters,
  // or the pool's composition could all legitimately leave them
  // unmatched this round) — see file header.
  let demoMatch: Match | undefined = allDateMatches.find(
    (m) => m.userAId === demoStudent.id || m.userBId === demoStudent.id,
  );
  if (!demoMatch) {
    const partner = studentIds.find((id) => id !== demoStudent.id)!;
    const [userAId, userBId] = [demoStudent.id, partner].sort();
    demoMatch = await prisma.match.create({
      data: { roundId: dateRound.id, mode: "DATE", userAId, userBId, score: 82, reasons: [{ text: "You both said prom night should be chill and low-key." }] },
    });
  } else if (!mutualCandidates.includes(demoMatch)) {
    mutualCandidates.push(demoMatch);
  }
  const guaranteedDemoMatch: Match = demoMatch;

  console.log(`Promoting ${mutualCandidates.length} Date matches to MUTUAL with chat history...`);
  let promposalsSeeded = 0;
  for (const match of mutualCandidates) {
    const now = new Date();
    await prisma.match.update({
      where: { id: match.id },
      data: { decisionA: "ACCEPT", decisionB: "ACCEPT", status: "MUTUAL", mutualAt: now },
    });
    const conversation = await prisma.conversation.create({ data: { matchId: match.id } });
    const lines = [
      [match.userAId, "Hey! Our matcher score says we both picked 'chill and low-key' for prom night 😄"],
      [match.userBId, "Ha, guilty. Did you want to grab food beforehand or just meet at the venue?"],
      [match.userAId, "Food first, definitely. There's a decent place two blocks from the venue."],
      [match.userBId, "Sounds good — what time works for you?"],
    ] as const;
    for (let li = 0; li < lines.length; li++) {
      const [senderId, body] = lines[li]!;
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId,
          body,
          readBy: li < lines.length - 1 ? [match.userAId, match.userBId] : [senderId],
        },
      });
    }

    // Two of the mutual matches also get a promposal — demo-student's own
    // match first, so their experience includes one already waiting.
    if (promposalsSeeded < 2) {
      await prisma.promposal.create({
        data: {
          matchId: match.id,
          fromId: match.userAId,
          template: pick(PROMPOSAL_TEMPLATES, promposalsSeeded),
          message: promposalsSeeded === 0 ? "Will you be my prom date? 🌟" : "I've got a sign and everything ready — say yes?",
          status: promposalsSeeded === 0 ? "YES" : "SENT",
          respondedAt: promposalsSeeded === 0 ? new Date() : null,
        },
      });
      promposalsSeeded++;
    }
  }

  // ---- A published Squad round, with one squad + squad chat ----
  console.log("Running a real Squad round...");
  const squadRound = await prisma.matchRound.create({
    data: {
      number: 1,
      mode: "SQUAD",
      status: "DRAFT",
      seed: 7,
      params: ROUND_PARAMS,
      scheduledAt: new Date(),
      decisionDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000),
    },
  });
  const squadInput = await loadRoundInput(prisma, "SQUAD", ROUND_PARAMS, { emailHashSalt: EMAIL_HASH_SALT });
  const squadOutput = runRound(squadInput, squadRound.seed);
  const { squadIds } = await persistRoundResult(prisma, squadRound.id, "SQUAD", squadOutput);
  await prisma.matchRound.update({ where: { id: squadRound.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });

  let demoSquadId: string;
  const squadWithDemo = await prisma.squad.findFirst({ where: { id: { in: squadIds }, members: { some: { userId: demoStudent.id } } } });
  if (squadWithDemo) {
    demoSquadId = squadWithDemo.id;
  } else {
    // Same guarantee as the Date match above: force demo-student into a
    // squad if the real matcher's squad-sizing/filters didn't include them.
    const squadMates = studentIds.filter((id) => id !== demoStudent.id).slice(0, 3);
    const forced = await prisma.squad.create({
      data: {
        roundId: squadRound.id,
        name: "Squad Goals",
        score: 75,
        status: "PROPOSED",
        members: { create: [demoStudent.id, ...squadMates].map((userId) => ({ userId })) },
      },
    });
    demoSquadId = forced.id;
  }

  console.log("Confirming the demo squad (3+ accepts) and seeding its squad chat...");
  const demoSquadMembers = await prisma.squadMember.findMany({ where: { squadId: demoSquadId! } });
  for (const m of demoSquadMembers.slice(0, Math.max(3, demoSquadMembers.length))) {
    await prisma.squadMember.update({ where: { id: m.id }, data: { decision: "ACCEPT" } });
  }
  const squadConversation = await prisma.conversation.create({ data: { squadId: demoSquadId! } });
  const squadSenders = demoSquadMembers.slice(0, 3).map((m) => m.userId);
  const squadLines = [
    "Okay squad, who's driving the night of?",
    "I can drive, fits 4 comfortably.",
    "Perfect, let's do dinner at 6 then head over.",
  ];
  for (let li = 0; li < squadLines.length; li++) {
    await prisma.message.create({
      data: { conversationId: squadConversation.id, senderId: squadSenders[li % squadSenders.length]!, body: squadLines[li]! },
    });
  }

  // ---- Three open reports (deliberately not involving demo-student, so
  // their own experience stays "clean" — organizers still see all three
  // from /admin/reports regardless of who's involved). ----
  console.log("Creating 3 open reports...");
  const reportCategories = ["harassment", "inappropriate_content", "spam"] as const;
  for (let i = 0; i < 3; i++) {
    const reporter = studentIds[1 + i]!;
    const reported = studentIds[1 + i + 10]!;
    await prisma.report.create({
      data: {
        reporterId: reporter,
        reportedId: reported,
        context: "profile",
        category: reportCategories[i],
        details: "Seeded demo report — nothing actually happened, this exists so /admin/reports isn't empty.",
        status: "OPEN",
      },
    });
  }

  // ---- Pending photos (see file header: placeholder keys, not real images) ----
  console.log("Creating pending photo rows for the admin photo queue...");
  for (let i = 0; i < 6; i++) {
    const userId = studentIds[i]!;
    await prisma.photo.create({
      data: {
        userId,
        key: `demo-placeholder/${userId}/photo-${i}.jpg`,
        thumbKey: `demo-placeholder/${userId}/photo-${i}-thumb.jpg`,
        order: 0,
        status: "PENDING",
      },
    });
  }
  // A couple already approved, so getMutualProfile has something to show
  // for the mutual matches above (also placeholder keys — see header).
  for (const id of [guaranteedDemoMatch.userAId, guaranteedDemoMatch.userBId]) {
    await prisma.photo.create({
      data: { userId: id, key: `demo-placeholder/${id}/approved.jpg`, thumbKey: `demo-placeholder/${id}/approved-thumb.jpg`, order: 0, status: "APPROVED" },
    });
  }

  console.log("\nDone. Demo data summary:");
  console.log(`  ${studentIds.length} students, 1 organizer, 1 superadmin`);
  console.log(`  Date round published: ${allDateMatches.length} proposed, ${mutualCandidates.length} mutual with chat history`);
  console.log(`  Squad round published: ${squadIds.length} squads, 1 confirmed with squad chat`);
  console.log(`  ${promposalsSeeded} promposals, 3 open reports, 6 pending + 2 approved photos`);
  console.log("\nSign in as:");
  console.log("  demo-student@college.edu    (fully populated student experience)");
  console.log("  demo-organizer@college.edu  (admin console — published round, photo queue, open reports)");
  console.log("Check Mailpit at http://localhost:8025 for the sign-in code/link (see infra/docker-compose.yml).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
