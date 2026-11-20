import type { Job } from "bullmq";
import type { JobPayloads } from "@prommatch/core";
import { sendPushToUser } from "../lib/push.js";

/** Processes jobs enqueued by apps/web/lib/notify.ts's `notify.push` enqueue call. */
export async function processNotifyPush(job: Job<JobPayloads["notify.push"]>) {
  const { userId, title, body, link } = job.data;
  await sendPushToUser(userId, { title, body, link });
}
