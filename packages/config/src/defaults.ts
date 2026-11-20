import { EventConfigSchema, type EventConfig } from "./schema.js";

/**
 * Placeholder defaults for a college that hasn't configured its event yet.
 * Organizers change all of this later from the admin console (it is loaded
 * into the EventConfig database table on first run by `pnpm setup`, and the
 * console writes back to that table — this file is only the seed).
 *
 * IMPORTANT for whoever deploys this: before going live, at minimum change
 * `allowedEmailDomains`, `superAdmins`, and the dates under `dates`.
 */
export const eventDefaults: EventConfig = {
  collegeName: "Your College",
  eventName: "Starlight Prom 2027",
  appName: "PromMatch",
  allowedEmailDomains: ["college.edu"],
  superAdmins: ["organizer@college.edu"],
  timeZone: "Asia/Kolkata",
  venue: { name: "Main Auditorium", address: "Campus", mapImage: null },
  dates: {
    questionnaireOpensAt: "2027-01-10T09:00:00+05:30",
    questionnaireClosesAt: "2027-01-28T23:59:00+05:30",
    drops: [
      "2027-01-30T19:00:00+05:30",
      "2027-02-06T19:00:00+05:30",
      "2027-02-13T19:00:00+05:30",
    ],
    decisionWindowHours: 72,
    promStartsAt: "2027-02-20T19:00:00+05:30",
    promEndsAt: "2027-02-20T23:30:00+05:30",
    chatRetentionDaysAfterProm: 14,
    dataRetentionDaysAfterProm: 30,
  },
  modes: { DATE: true, FRIEND: true, SQUAD: true },
  departments: [
    "Chemical",
    "Civil",
    "Computer Science",
    "Electrical",
    "Electronics",
    "Mechanical",
    "Biotechnology",
    "Other",
  ],
  years: [1, 2, 3, 4, 5],
  promVibes: [
    "Classic elegance",
    "Dance-floor legend",
    "Chill and cosy",
    "Main-character energy",
    "Here for the food",
  ],
  interests: [
    "music",
    "dance",
    "cricket",
    "football",
    "gaming",
    "anime",
    "movies",
    "books",
    "coding",
    "art",
    "photography",
    "fitness",
    "travel",
    "food",
    "fashion",
    "memes",
    "theatre",
    "robotics",
    "startups",
    "volunteering",
  ],
  prompts: [
    "My ideal prom song is...",
    "The way to win me over is...",
    "Two truths and a lie...",
    "My hidden talent is...",
    "After prom you'll find me...",
  ],
  matching: {
    minScore: 55,
    proposalsPerUser: 3,
    candidatesPerUser: 40,
    choiceMismatch: 0.2,
    autoPublishRounds: false,
  },
  flags: {
    revealPhotosBeforeAccept: false,
    chatImages: false,
    readReceiptsDefault: true,
  },
  schedule: [
    { time: "19:00", item: "Doors open and photos" },
    { time: "20:00", item: "Dinner" },
    { time: "21:00", item: "Dance floor opens" },
    { time: "23:00", item: "Last song" },
  ],
  emergencyContacts: [{ name: "Organizer helpline", phone: "+91 00000 00000" }],
  counsellingLink: "https://college.edu/counselling",
  theme: { mode: "dark", overrides: {} },
};

/**
 * If the shipped defaults have drifted into the past (because time has
 * passed since this template was written), shift every date forward by
 * whole weeks so the timeline stays in the future and keeps its order and
 * spacing. Used by `pnpm setup` and the demo seed; never mutates the
 * exported `eventDefaults` object itself.
 */
export function freshEventDefaults(now: Date = new Date()): EventConfig {
  const base = structuredClone(eventDefaults);
  const firstMilestone = Date.parse(base.dates.questionnaireOpensAt);
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  if (firstMilestone >= now.getTime()) {
    return EventConfigSchema.parse(base);
  }

  const weeksToShift = Math.ceil((now.getTime() - firstMilestone) / weekMs) + 1;
  const shiftMs = weeksToShift * weekMs;

  const shift = (iso: string) => new Date(Date.parse(iso) + shiftMs).toISOString();

  base.dates = {
    ...base.dates,
    questionnaireOpensAt: shift(base.dates.questionnaireOpensAt),
    questionnaireClosesAt: shift(base.dates.questionnaireClosesAt),
    drops: base.dates.drops.map(shift),
    promStartsAt: shift(base.dates.promStartsAt),
    promEndsAt: shift(base.dates.promEndsAt),
  };

  return EventConfigSchema.parse(base);
}
