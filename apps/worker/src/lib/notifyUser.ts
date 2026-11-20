import { prisma } from "@prommatch/db";
import { sendPushToUser } from "./push.js";
import { sendNotificationEmail } from "./mail.js";

export interface NotifyUserOptions {
  type: string;
  title: string;
  body: string;
  link?: string;
}

/** Notification types that also get an email — kept in sync with apps/web/lib/notify.ts's EMAIL_TEMPLATES. */
const EMAIL_TEMPLATES: Record<string, string> = {
  "match:mutual": "MutualMatch",
  "promposal:received": "PromposalReceived",
  "round:published": "MatchDrop",
};

/**
 * The worker-side counterpart to apps/web's lib/notify.ts: used when a
 * *job* (round auto-publish, reminders, digests) needs to notify a
 * student directly, rather than a tRPC mutation enqueueing notify.push/
 * notify.email for this same worker to pick up later. Writes the in-app
 * Notification row and delivers push + email immediately in-process —
 * there's no point enqueueing a job from inside another job.
 */
export async function notifyUser(userId: string, opts: NotifyUserOptions): Promise<void> {
  await prisma.notification.create({
    data: { userId, type: opts.type, title: opts.title, body: opts.body, link: opts.link },
  });

  await sendPushToUser(userId, { title: opts.title, body: opts.body, link: opts.link });

  const template = EMAIL_TEMPLATES[opts.type];
  if (template) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, profile: { select: { displayName: true } } } });
    if (user?.email) {
      await sendNotificationEmail(user.email, template, { title: opts.title, body: opts.body, link: opts.link }, user.profile?.displayName ?? "");
    }
  }
}
