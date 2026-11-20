import { z } from "zod";
import type { ModeKey } from "./schema.js";

export const AnswerTypeSchema = z.enum(["likert5", "choice", "multiselect"]);
export type AnswerType = z.infer<typeof AnswerTypeSchema>;

export const ScoringSchema = z.enum([
  "similarity",
  "complementary",
  "choiceExact",
  "jaccard",
]);
export type Scoring = z.infer<typeof ScoringSchema>;

export interface QuestionSeed {
  key: string;
  section: string;
  text: string;
  type: AnswerType;
  /** Options for choice/multiselect; omitted for likert5 (always 1-5). */
  options?: string[];
  scoring: Scoring;
  /** Multiplies the importance-derived weight. 1 = normal. */
  weightDefault: number;
  /** Only shown to students who selected this mode. Omit = shown to all. */
  modes?: ModeKey[];
  /** May be chosen as one of a student's up to-3 dealbreakers. */
  dealbreakerCapable?: boolean;
  order: number;
}

/**
 * Seed data for the `Question` table (packages/db/prisma/seed.ts loads this).
 * Organizers can add, edit, reorder and deactivate questions afterwards from
 * the admin console — this is the starting bank, not a fixed list.
 */
export const questionBank: QuestionSeed[] = [
  { key: "night_energy", section: "Prom night", text: "My ideal prom night energy is...", type: "likert5", scoring: "similarity", weightDefault: 1, order: 1 },
  { key: "dance_floor", section: "Prom night", text: "How much time do you want on the dance floor?", type: "likert5", scoring: "similarity", weightDefault: 1, order: 2 },
  { key: "photos", section: "Prom night", text: "Photos at prom are...", type: "likert5", scoring: "similarity", weightDefault: 1, order: 3 },
  { key: "afterparty", section: "Prom night", text: "After prom I'd rather...", type: "choice", options: ["head home", "late food run", "afterparty", "sunrise plan"], scoring: "choiceExact", weightDefault: 1, order: 4 },
  { key: "dress_coord", section: "Prom night", text: "Coordinating outfits with my date", type: "likert5", scoring: "similarity", weightDefault: 1, modes: ["DATE"], order: 5 },
  { key: "arrival", section: "Prom night", text: "Getting there", type: "choice", options: ["on time", "fashionably late", "with a big group", "whatever"], scoring: "choiceExact", weightDefault: 1, order: 6 },
  { key: "food_pref", section: "Prom night", text: "Food preference", type: "choice", options: ["veg", "non-veg", "vegan", "Jain", "no preference"], scoring: "choiceExact", weightDefault: 0.5, dealbreakerCapable: true, order: 7 },

  { key: "social_battery", section: "Personality", text: "In a big crowd I feel...", type: "likert5", scoring: "similarity", weightDefault: 1, order: 8 },
  { key: "conversation", section: "Personality", text: "I'd rather talk about...", type: "likert5", scoring: "similarity", weightDefault: 1, order: 9 },
  { key: "humour", section: "Personality", text: "My humour is mostly...", type: "choice", options: ["dry", "silly", "sarcastic", "wholesome", "memes"], scoring: "choiceExact", weightDefault: 1, order: 10 },
  { key: "planner", section: "Personality", text: "I am a planner or spontaneous?", type: "likert5", scoring: "complementary", weightDefault: 1, order: 11 },
  { key: "initiator", section: "Personality", text: "In conversation I usually...", type: "likert5", scoring: "complementary", weightDefault: 1, order: 12 },
  { key: "punctuality", section: "Personality", text: "Being late is...", type: "likert5", scoring: "similarity", weightDefault: 1, order: 13 },
  { key: "competitive", section: "Personality", text: "I am competitive", type: "likert5", scoring: "similarity", weightDefault: 1, order: 14 },

  { key: "weekend", section: "Lifestyle", text: "A perfect weekend is...", type: "choice", options: ["outdoors", "gaming", "sports", "art and music", "studying", "sleeping"], scoring: "choiceExact", weightDefault: 1, order: 15 },
  { key: "music", section: "Lifestyle", text: "Music I'd want played at prom", type: "multiselect", options: ["Bollywood", "pop", "hip-hop", "EDM", "indie", "rock", "classical", "regional"], scoring: "jaccard", weightDefault: 1, order: 16 },
  { key: "sports", section: "Lifestyle", text: "Watching or playing sports", type: "likert5", scoring: "similarity", weightDefault: 1, order: 17 },
  { key: "gaming", section: "Lifestyle", text: "Games are part of my life", type: "likert5", scoring: "similarity", weightDefault: 1, order: 18 },
  { key: "movies", section: "Lifestyle", text: "Movie night pick", type: "choice", options: ["action", "comedy", "romance", "horror", "anime", "documentary"], scoring: "choiceExact", weightDefault: 1, order: 19 },
  { key: "early_bird", section: "Lifestyle", text: "Morning or night person?", type: "likert5", scoring: "similarity", weightDefault: 1, order: 20 },

  { key: "texting", section: "Communication", text: "Texting style", type: "likert5", scoring: "similarity", weightDefault: 1, order: 21 },
  { key: "reply_speed", section: "Communication", text: "Slow replies bother me", type: "likert5", scoring: "similarity", weightDefault: 1, order: 22 },
  { key: "plans_change", section: "Communication", text: "When plans change last minute I...", type: "likert5", scoring: "similarity", weightDefault: 1, order: 23 },

  { key: "commitment", section: "Expectations", text: "Prom with a match should be...", type: "likert5", scoring: "similarity", weightDefault: 2, modes: ["DATE"], order: 24 },
  { key: "pda", section: "Expectations", text: "Comfort with affection in public", type: "likert5", scoring: "similarity", weightDefault: 1, modes: ["DATE"], order: 25 },
  { key: "cost_split", section: "Expectations", text: "Costs like tickets and food should be...", type: "choice", options: ["split evenly", "whoever asked pays", "take turns", "flexible"], scoring: "choiceExact", weightDefault: 1, order: 26 },
  { key: "friends_join", section: "Expectations", text: "I'd like our friend groups to hang out together", type: "likert5", scoring: "similarity", weightDefault: 1, order: 27 },

  { key: "squad_role", section: "Squad", text: "In a group I'm usually the...", type: "choice", options: ["organiser", "hype person", "photographer", "chill one", "DJ"], scoring: "choiceExact", weightDefault: 1, modes: ["SQUAD"], order: 28 },
  { key: "squad_size", section: "Squad", text: "Ideal group size", type: "choice", options: ["4", "5-6", "7-8"], scoring: "choiceExact", weightDefault: 1, modes: ["SQUAD"], order: 29 },

  { key: "values_kind", section: "Values", text: "Kindness matters more than being cool", type: "likert5", scoring: "similarity", weightDefault: 1, order: 30 },
  { key: "values_ambition", section: "Values", text: "I'm very focused on my career", type: "likert5", scoring: "similarity", weightDefault: 1, order: 31 },
  { key: "substance", section: "Values", text: "My comfort with alcohol at afterparties", type: "likert5", scoring: "similarity", weightDefault: 1, dealbreakerCapable: true, order: 32 },
];
