import { prisma } from "@prommatch/db";
import { notifyUser } from "../lib/notifyUser.js";

const STALE_AFTER_HOURS = 48;

/**
 * Students stuck in ONBOARDING (verified their email, started the wizard,
 * never finished it) for more than 48 hours get one nudge. Like
 * remindersDecide, this has no "already reminded" tracking, so it will
 * remind again on a later tick if they're still stuck — a once-per-run
 * cooldown isn't worth a schema change for a one-line nudge.
 */
export async function processRemindersOnboarding() {
  const cutoff = new Date(Date.now() - STALE_AFTER_HOURS * 60 * 60 * 1000);

  const stuck = await prisma.user.findMany({
    where: { status: "ONBOARDING", updatedAt: { lt: cutoff } },
    select: { id: true },
  });

  for (const u of stuck) {
    await notifyUser(u.id, {
      type: "onboarding:reminder",
      title: "Finish setting up your profile",
      body: "You're a couple of steps away from your first Match Drop.",
      link: "/welcome",
    });
  }

  return { reminded: stuck.length };
}
