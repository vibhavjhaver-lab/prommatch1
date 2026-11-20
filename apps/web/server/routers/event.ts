import { getEventConfig } from "../../lib/config.js";
import { publicProcedure, router } from "../trpc.js";

export const eventRouter = router({
  /** Public, redacted view — never exposes superAdmins emails or raw internal params. */
  publicConfig: publicProcedure.query(async () => {
    const config = await getEventConfig();
    return {
      collegeName: config.collegeName,
      eventName: config.eventName,
      appName: config.appName,
      timeZone: config.timeZone,
      venue: config.venue,
      dates: config.dates,
      modes: config.modes,
      departments: config.departments,
      years: config.years,
      promVibes: config.promVibes,
      interests: config.interests,
      prompts: config.prompts,
      schedule: config.schedule,
      emergencyContacts: config.emergencyContacts,
      counsellingLink: config.counsellingLink,
      theme: config.theme,
    };
  }),

  countdown: publicProcedure.query(async () => {
    const config = await getEventConfig();
    const now = Date.now();
    const milestones = [
      { key: "questionnaireCloses", at: config.dates.questionnaireClosesAt },
      ...config.dates.drops.map((d, i) => ({ key: `drop${i + 1}`, at: d })),
      { key: "promStarts", at: config.dates.promStartsAt },
    ];
    const next = milestones.find((m) => Date.parse(m.at) > now) ?? milestones[milestones.length - 1];
    return { next, serverNow: new Date(now).toISOString() };
  }),
});
