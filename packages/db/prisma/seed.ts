import { PrismaClient } from "@prisma/client";
import { freshEventDefaults, questionBank } from "@prommatch/config";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding event config...");
  const config = freshEventDefaults();
  await prisma.eventConfig.upsert({
    where: { key: "event" },
    create: { key: "event", value: config as unknown as object },
    update: { value: config as unknown as object },
  });

  console.log(`Seeding ${questionBank.length} questions...`);
  for (const q of questionBank) {
    await prisma.question.upsert({
      where: { key: q.key },
      create: {
        key: q.key,
        section: q.section,
        text: q.text,
        type: q.type,
        options: q.options ?? [],
        weightDefault: q.weightDefault,
        complementary: q.scoring === "complementary",
        modes: q.modes ?? ["DATE", "FRIEND", "SQUAD"],
        order: q.order,
        active: true,
      },
      update: {
        section: q.section,
        text: q.text,
        type: q.type,
        options: q.options ?? [],
        weightDefault: q.weightDefault,
        complementary: q.scoring === "complementary",
        modes: q.modes ?? ["DATE", "FRIEND", "SQUAD"],
        order: q.order,
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
