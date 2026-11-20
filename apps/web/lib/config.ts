import { prisma } from "@prommatch/db";
import { EventConfigSchema, freshEventDefaults, type EventConfig } from "@prommatch/config";

let cache: { value: EventConfig; expiresAt: number } | null = null;
const TTL_MS = 30_000;

/**
 * Reads the runtime-editable EventConfig from the database (the admin
 * console writes to it); seeds from freshEventDefaults() on first read if
 * the row doesn't exist yet. Cached for 30s to avoid a DB round-trip on
 * every request — the admin console calls `invalidateConfigCache()` after
 * writing so changes show up immediately for the organizer who made them.
 */
export async function getEventConfig(): Promise<EventConfig> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;

  const row = await prisma.eventConfig.findUnique({ where: { key: "event" } });
  const value = row ? EventConfigSchema.parse(row.value) : freshEventDefaults();

  if (!row) {
    await prisma.eventConfig.create({ data: { key: "event", value: value as unknown as object } });
  }

  cache = { value, expiresAt: Date.now() + TTL_MS };
  return value;
}

export async function updateEventConfig(next: EventConfig): Promise<EventConfig> {
  const validated = EventConfigSchema.parse(next);
  await prisma.eventConfig.upsert({
    where: { key: "event" },
    create: { key: "event", value: validated as unknown as object },
    update: { value: validated as unknown as object },
  });
  invalidateConfigCache();
  return validated;
}

export function invalidateConfigCache(): void {
  cache = null;
}
