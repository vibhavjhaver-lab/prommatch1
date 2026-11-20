import { describe, expect, it } from "vitest";
import { EventConfigSchema } from "./schema.js";
import { eventDefaults, freshEventDefaults } from "./defaults.js";

describe("eventDefaults", () => {
  it("validates against EventConfigSchema", () => {
    expect(() => EventConfigSchema.parse(eventDefaults)).not.toThrow();
  });
});

describe("freshEventDefaults", () => {
  it("leaves dates untouched when they are already in the future", () => {
    const beforeEverything = new Date("2020-01-01T00:00:00Z");
    const fresh = freshEventDefaults(beforeEverything);
    expect(fresh.dates.questionnaireOpensAt).toBe(eventDefaults.dates.questionnaireOpensAt);
  });

  it("shifts every date forward by whole weeks when the template has gone stale, keeping order", () => {
    const farFuture = new Date("2030-06-01T00:00:00Z");
    const fresh = freshEventDefaults(farFuture);

    expect(Date.parse(fresh.dates.questionnaireOpensAt)).toBeGreaterThan(farFuture.getTime());
    expect(Date.parse(fresh.dates.questionnaireClosesAt)).toBeGreaterThan(
      Date.parse(fresh.dates.questionnaireOpensAt),
    );
    fresh.dates.drops.forEach((d, i) => {
      if (i > 0) {
        const prevDrop = fresh.dates.drops[i - 1];
        expect(prevDrop).toBeDefined();
        expect(Date.parse(d)).toBeGreaterThan(Date.parse(prevDrop as string));
      }
    });
    expect(Date.parse(fresh.dates.promStartsAt)).toBeGreaterThan(
      Date.parse(fresh.dates.drops[fresh.dates.drops.length - 1] as string),
    );
    expect(() => EventConfigSchema.parse(fresh)).not.toThrow();
  });
});
