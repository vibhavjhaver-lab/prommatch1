import { prisma } from "@prommatch/db";
import { notifyUser } from "../lib/notifyUser.js";

/**
 * Delivers any Announcement whose publishAt has passed and that hasn't
 * been sent yet (sentAt is the guard against double-sending across
 * ticks). "Audience" targeting is deliberately simple — see the
 * audienceWhere() cases below — matching what admin.announcements.create
 * actually offers in the console (spec section 10).
 */
export async function processAnnouncementsSend() {
  const due = await prisma.announcement.findMany({
    where: { publishAt: { lte: new Date() }, sentAt: null },
  });

  let totalSent = 0;
  for (const announcement of due) {
    const userIds = await audienceUserIds(announcement.audience);
    await Promise.all(
      userIds.map((userId) =>
        notifyUser(userId, { type: "announcement", title: announcement.title, body: announcement.body }),
      ),
    );
    await prisma.announcement.update({ where: { id: announcement.id }, data: { sentAt: new Date() } });
    totalSent += userIds.length;
  }

  return { announcementsSent: due.length, notificationsSent: totalSent };
}

async function audienceUserIds(audience: string): Promise<string[]> {
  const activeStatuses = ["ACTIVE", "PAUSED"] as const;

  if (audience === "all") {
    const users = await prisma.user.findMany({ where: { status: { in: activeStatuses } }, select: { id: true } });
    return users.map((u) => u.id);
  }

  if (audience === "DATE" || audience === "FRIEND" || audience === "SQUAD") {
    const prefs = await prisma.matchPreferences.findMany({
      where: { modes: { has: audience }, user: { status: { in: activeStatuses } } },
      select: { userId: true },
    });
    return prefs.map((p) => p.userId);
  }

  if (audience === "unmatched") {
    const matchedIds = await matchedUserIds();
    const users = await prisma.user.findMany({
      where: { status: { in: activeStatuses }, id: { notIn: matchedIds } },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  if (audience === "matched") {
    return matchedUserIds();
  }

  if (audience === "going_together") {
    const yesPromposals = await prisma.promposal.findMany({ where: { status: "YES" }, select: { fromId: true, match: { select: { userAId: true, userBId: true } } } });
    const ids = new Set<string>();
    for (const p of yesPromposals) {
      ids.add(p.fromId);
      if (p.match) {
        ids.add(p.match.userAId);
        ids.add(p.match.userBId);
      }
    }
    return [...ids];
  }

  return [];
}

async function matchedUserIds(): Promise<string[]> {
  const matches = await prisma.match.findMany({ where: { status: "MUTUAL" }, select: { userAId: true, userBId: true } });
  return [...new Set(matches.flatMap((m) => [m.userAId, m.userBId]))];
}
