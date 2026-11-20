import { prisma } from "@prommatch/db";
import { EventConfigSchema, freshEventDefaults, type EventConfig } from "@prommatch/config";

/**
 * Worker-side counterpart to apps/web's lib/config.ts. No TTL cache here —
 * jobs run at most every few minutes, not per-request, so a DB round-trip
 * per job run is cheap and it means a config change always takes effect
 * on the very next tick rather than up to 30s later.
 */
export async function getEventConfig(): Promise<EventConfig> {
  const row = await prisma.eventConfig.findUnique({ where: { key: "event" } });
  return row ? EventConfigSchema.parse(row.value) : freshEventDefaults();
}
