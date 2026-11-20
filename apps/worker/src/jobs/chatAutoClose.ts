import { prisma } from "@prommatch/db";
import { getEventConfig } from "../lib/config.js";

/**
 * Closes every still-open conversation once prom night plus the
 * configured retention window (EventConfig.dates.chatRetentionDaysAfterProm)
 * has passed. Closing just sets closedAt — chat.send's assertParticipant
 * check (apps/web/server/routers/chat.ts) is what actually stops new
 * messages; this job never deletes message history (that's
 * data.retentionWipe's job, on a separate, much longer clock).
 */
export async function processChatAutoClose() {
  const config = await getEventConfig();
  const cutoff = Date.parse(config.dates.promEndsAt) + config.dates.chatRetentionDaysAfterProm * 24 * 60 * 60 * 1000;
  if (Date.now() < cutoff) return { closed: 0 };

  const result = await prisma.conversation.updateMany({
    where: { closedAt: null },
    data: { closedAt: new Date() },
  });

  return { closed: result.count };
}
