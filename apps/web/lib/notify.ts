import { enqueue } from "@prommatch/core";
import { prisma } from "@prommatch/db";
import { getEnv } from "./env.js";

export interface NotifyOptions {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  /** Skip push/email, in-app only (used for low-priority notices). */
  inAppOnly?: boolean;
}

/** Notification types that also get an email, and the @prommatch/emails template that renders it. */
const EMAIL_TEMPLATES: Record<string, string> = {
  "match:mutual": "MutualMatch",
  "promposal:received": "PromposalReceived",
  "round:published": "MatchDrop",
};

/**
 * Writes the in-app Notification row, then enqueues push (if the student
 * has at least one registered PushSubscription — no point queuing a job
 * that would just no-op) and, for the notification types in
 * EMAIL_TEMPLATES, an email job too. Spec section 14, Channels.
 *
 * NOTE: there's no quiet-hours or per-category unsubscribe model yet
 * (notifications.updatePrefs is currently a documented no-op — see that
 * router) — every enqueued push/email goes out immediately. Worth
 * building before a real launch; tracked in PROGRESS.md.
 */
export async function notify(opts: NotifyOptions): Promise<void> {
  await prisma.notification.create({
    data: { userId: opts.userId, type: opts.type, title: opts.title, body: opts.body, link: opts.link },
  });

  if (opts.inAppOnly) return;

  const env = getEnv();

  const pushCount = await prisma.pushSubscription.count({ where: { userId: opts.userId } });
  if (pushCount > 0) {
    await enqueue(env.REDIS_URL, "notify.push", { userId: opts.userId, title: opts.title, body: opts.body, link: opts.link });
  }

  const template = EMAIL_TEMPLATES[opts.type];
  if (template) {
    const user = await prisma.user.findUnique({ where: { id: opts.userId }, select: { email: true } });
    if (user?.email) {
      await enqueue(env.REDIS_URL, "notify.email", {
        to: user.email,
        template,
        props: { title: opts.title, body: opts.body, link: opts.link },
      });
    }
  }
}
