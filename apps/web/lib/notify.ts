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

/**
 * Writes the in-app Notification row, then enqueues push + email jobs for
 * the worker to deliver (respecting quiet hours and unsubscribe state,
 * which the worker checks — see apps/worker/src/jobs/notify.ts). Spec
 * section 14, Channels.
 */
export async function notify(opts: NotifyOptions): Promise<void> {
  await prisma.notification.create({
    data: { userId: opts.userId, type: opts.type, title: opts.title, body: opts.body, link: opts.link },
  });

  if (opts.inAppOnly) return;

  const env = getEnv();
  await enqueue(env.REDIS_URL, "notify.push", { userId: opts.userId, title: opts.title, body: opts.body, link: opts.link });
}
