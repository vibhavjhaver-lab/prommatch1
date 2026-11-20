import { Queue } from "bullmq";
import IORedis from "ioredis";

/**
 * Shared job-name constants and payload types for every queue in spec
 * section 14. apps/web enqueues (it owns the HTTP-facing mutations); only
 * apps/worker registers Workers that process them. Keeping names/payloads
 * here means both sides stay in sync by construction.
 */
export const QUEUE_NAME = "prommatch";

export type JobName =
  | "round.autoPublish"
  | "round.expireDecisions"
  | "reminders.decide"
  | "reminders.onboarding"
  | "announcements.send"
  | "chat.autoClose"
  | "data.deleteAccounts"
  | "data.retentionWipe"
  | "data.export"
  | "digest.organizers"
  | "notify.push"
  | "notify.email";

export interface JobPayloads {
  "round.autoPublish": { mode: "DATE" | "FRIEND" | "SQUAD"; dropIndex: number };
  "round.expireDecisions": Record<string, never>;
  "reminders.decide": Record<string, never>;
  "reminders.onboarding": Record<string, never>;
  "announcements.send": Record<string, never>;
  "chat.autoClose": Record<string, never>;
  "data.deleteAccounts": Record<string, never>;
  "data.retentionWipe": Record<string, never>;
  "data.export": { userId: string };
  "digest.organizers": Record<string, never>;
  "notify.push": { userId: string; title: string; body: string; link?: string };
  "notify.email": { to: string; template: string; props: Record<string, unknown> };
}

let queue: Queue | undefined;
let connection: IORedis | undefined;

function getConnection(redisUrl: string): IORedis {
  if (!connection) {
    connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  }
  return connection;
}

export function getQueue(redisUrl: string): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, { connection: getConnection(redisUrl) });
  }
  return queue;
}

export async function enqueue<K extends JobName>(
  redisUrl: string,
  name: K,
  payload: JobPayloads[K],
  opts?: { jobId?: string; delayMs?: number },
): Promise<void> {
  await getQueue(redisUrl).add(name, payload, {
    jobId: opts?.jobId,
    delay: opts?.delayMs,
    removeOnComplete: 1000,
    removeOnFail: 1000,
  });
}
