import type { Job } from "bullmq";
import type { JobPayloads } from "@prommatch/core";
import { prisma } from "@prommatch/db";
import { sendNotificationEmail } from "../lib/mail.js";

/** Processes jobs enqueued by apps/web/lib/notify.ts's `notify.email` enqueue call. */
export async function processNotifyEmail(job: Job<JobPayloads["notify.email"]>) {
  const { to, template, props } = job.data;
  const user = await prisma.user.findUnique({ where: { email: to }, select: { profile: { select: { displayName: true } } } });
  await sendNotificationEmail(to, template, props, user?.profile?.displayName ?? "");
}
