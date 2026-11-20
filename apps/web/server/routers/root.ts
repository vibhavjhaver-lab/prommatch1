import { router } from "../trpc.js";
import { adminRouter } from "./admin.js";
import { authRouter } from "./auth.js";
import { chatRouter } from "./chat.js";
import { eventRouter } from "./event.js";
import { matchesRouter } from "./matches.js";
import { meRouter } from "./me.js";
import { notificationsRouter } from "./notifications.js";
import { prefsRouter } from "./prefs.js";
import { profileRouter } from "./profile.js";
import { promposalRouter } from "./promposal.js";
import { questionnaireRouter } from "./questionnaire.js";
import { safetyRouter } from "./safety.js";
import { squadRouter } from "./squad.js";

export const appRouter = router({
  auth: authRouter,
  profile: profileRouter,
  questionnaire: questionnaireRouter,
  prefs: prefsRouter,
  matches: matchesRouter,
  squad: squadRouter,
  chat: chatRouter,
  promposal: promposalRouter,
  safety: safetyRouter,
  notifications: notificationsRouter,
  me: meRouter,
  event: eventRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
