#!/usr/bin/env tsx
/**
 * Dev-only demo data: ~24 fake students (already ACTIVE, skipping email
 * verification) with profiles, preferences, and questionnaire answers,
 * plus one organizer and one superadmin — enough to actually create a
 * Match Drop locally and see results. Never run this against a real
 * deployment; it's gated below on NODE_ENV !== "production" as a guard
 * rail, but the real guard is just: don't run `pnpm seed:demo` in prod.
 *
 * Requires prisma/seed.ts to have already run (via `prisma migrate dev`
 * or `pnpm --filter @prommatch/db exec prisma db seed`) so Questions and
 * EventConfig exist — this script answers those questions, it doesn't
 * create them.
 */
import { prisma } from "@prommatch/db";
import { questionBank } from "@prommatch/config";

const FIRST_NAMES = [
  "Avery", "Priya", "Jordan", "Mei", "Diego", "Sam", "Nia", "Luca", "Zara", "Theo",
  "Ingrid", "Omar", "Lena", "Kai", "Fatima", "Noah", "Yuki", "Elena", "Max", "Aisha",
  "Finn", "Rosa", "Dev", "Clara",
];
const DEPARTMENTS = ["Computer Science", "Mechanical Engineering", "Business", "Psychology", "Biology", "Art & Design"];
const PROM_VIBES = ["Chill and low-key", "Dance all night", "Dressed up, photos first", "Just here for the food"];
const INTERESTS = ["music", "hiking", "gaming", "cooking", "movies", "reading", "sports", "art", "travel", "coding"];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]!;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed demo data with NODE_ENV=production.");
    process.exit(1);
  }

  const questions = await prisma.question.findMany();
  if (questions.length === 0) {
    console.error("No questions found — run the real seed first (prisma migrate dev runs it automatically).");
    process.exit(1);
  }

  console.log("Creating organizer + superadmin...");
  await prisma.user.upsert({
    where: { email: "organizer@demo.college.edu" },
    create: { email: "organizer@demo.college.edu", role: "ORGANIZER", status: "ACTIVE" },
    update: {},
  });
  await prisma.user.upsert({
    where: { email: "admin@demo.college.edu" },
    create: { email: "admin@demo.college.edu", role: "SUPERADMIN", status: "ACTIVE" },
    update: {},
  });

  console.log(`Creating ${FIRST_NAMES.length} demo students...`);
  for (let i = 0; i < FIRST_NAMES.length; i++) {
    const name = FIRST_NAMES[i]!;
    const email = `${name.toLowerCase()}@demo.college.edu`;

    const user = await prisma.user.upsert({
      where: { email },
      create: { email, role: "STUDENT", status: "ACTIVE", ageConfirmedAt: new Date(), termsVersion: "2026.1" },
      update: {},
    });

    await prisma.profile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        displayName: name,
        yearOfStudy: (i % 4) + 1,
        department: pick(DEPARTMENTS, i),
        bio: "Demo profile — seeded for local testing.",
        prompts: [],
        interests: [INTERESTS[i % INTERESTS.length]!, INTERESTS[(i + 1) % INTERESTS.length]!, INTERESTS[(i + 2) % INTERESTS.length]!],
        promVibe: pick(PROM_VIBES, i),
      },
      update: {},
    });

    const gender = i % 3 === 0 ? "WOMAN" : i % 3 === 1 ? "MAN" : "NONBINARY";
    await prisma.matchPreferences.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        modes: ["DATE", "FRIEND"],
        gender,
        seekingGenders: ["WOMAN", "MAN", "NONBINARY"],
        yearMin: 1,
        yearMax: 5,
        sameDeptOk: true,
        dealbreakers: {},
        excludedEmails: [],
      },
      update: {},
    });

    for (const q of questions) {
      const value = q.type === "likert5" ? 1 + ((i + q.order) % 5) : (q.options as string[])[(i + q.order) % Math.max((q.options as string[]).length, 1)];
      if (value === undefined) continue;
      await prisma.answer.upsert({
        where: { userId_questionId: { userId: user.id, questionId: q.id } },
        create: { userId: user.id, questionId: q.id, value: value as object, importance: 2 },
        update: {},
      });
    }
  }

  console.log(`Done. ${questionBank.length} question types answered for ${FIRST_NAMES.length} demo students.`);
  console.log("Sign in as any of them via the dev-only magic-link bypass, or check your local mail catcher (MailHog/Mailpit) for the code.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
