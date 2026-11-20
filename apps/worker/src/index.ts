import { Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_NAME, type JobName } from "@prommatch/core";
import { getEnv } from "./env.js";
import { processRoundAutoPublish } from "./jobs/roundAutoPublish.js";
import { processRoundExpireDecisions } from "./jobs/roundExpireDecisions.js";
import { processRemindersDecide } from "./jobs/remindersDecide.js";
import { processRemindersOnboarding } from "./jobs/remindersOnboarding.js";
import { processAnnouncementsSend } from "./jobs/announcementsSend.js";
import { processChatAutoClose } from "./jobs/chatAutoClose.js";
import { processDataDeleteAccounts } from "./jobs/dataDeleteAccounts.js";
import { processDataRetentionWipe } from "./jobs/dataRetentionWipe.js";
import { processDataExport } from "./jobs/dataExport.js";
import { processDigestOrganizers } from "./jobs/digestOrganizers.js";
import { processNotifyPush } from "./jobs/notifyPush.js";
import { processNotifyEmail } from "./jobs/notifyEmail.js";

const env = getEnv();
const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

/**
 * One handler per JobName (jobs.ts), dispatched from a single BullMQ
 * Worker rather than one Worker per queue — there's only ever one queue
 * (QUEUE_NAME = "prommatch"), so this keeps one Redis connection and one
 * concurrency setting instead of twelve. If a particular job type turns
 * out to need its own concurrency/rate limit later, split it into its
 * own `new Worker(...)` with a name filter at that point.
 */
const handlers: Record<JobName, (job: Job) => Promise<unknown>> = {
  "round.autoPublish": processRoundAutoPublish,
  "round.expireDecisions": processRoundExpireDecisions,
  "reminders.decide": processRemindersDecide,
  "reminders.onboarding": processRemindersOnboarding,
  "announcements.send": processAnnouncementsSend,
  "chat.autoClose": processChatAutoClose,
  "data.deleteAccounts": processDataDeleteAccounts,
  "data.retentionWipe": processDataRetentionWipe,
  "data.export": processDataExport,
  "digest.organizers": processDigestOrganizers,
  "notify.push": processNotifyPush,
  "notify.email": processNotifyEmail,
};

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    const handler = handlers[job.name as JobName];
    if (!handler) {
      // eslint-disable-next-line no-console
      console.warn(`No handler registered for job "${job.name}" — skipping.`);
      return;
    }
    return handler(job);
  },
  { connection, concurrency: 5 },
);

worker.on("completed", (job) => {
  // eslint-disable-next-line no-console
  console.log(`[worker] ${job.name} (${job.id}) completed`);
});

worker.on("failed", (job, err) => {
  // eslint-disable-next-line no-console
  console.error(`[worker] ${job?.name} (${job?.id}) failed:`, err);
});

// eslint-disable-next-line no-console
console.log(`[worker] listening on queue "${QUEUE_NAME}"`);

async function shutdown() {
  await worker.close();
  connection.disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
