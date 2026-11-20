/**
 * Single authorisation surface for the whole app (spec section 6,
 * "Architecture rules": no authorisation checks inline in UI code —
 * routers, server actions and jobs all call `can()`).
 */

export type Role = "STUDENT" | "ORGANIZER" | "SUPERADMIN";

export type Action =
  | "profile:editOwn"
  | "match:seeIdentity"
  | "round:runPreviewPublish"
  | "photo:approve"
  | "report:handle"
  | "account:suspendShort" // up to 7 days
  | "account:suspendAny"
  | "account:ban"
  | "config:editDatesAndCopy"
  | "config:editAll"
  | "data:exportAggregate"
  | "data:exportFull"
  | "data:wipeEvent"
  | "organizer:manage"
  | "chat:readForReport";

export interface PolicySubject {
  role: Role;
  userId: string;
}

export interface PolicyResource {
  ownerId?: string;
  questionnaireOpen?: boolean;
  hasReportReference?: boolean;
}

type PolicyFn = (subject: PolicySubject, resource: PolicyResource) => boolean;

const POLICIES: Record<Action, PolicyFn> = {
  "profile:editOwn": (s, r) => s.userId === r.ownerId,

  // Students never see a match's identity directly; this policy exists only
  // for the organizer/superadmin "see via report review" path — the app's
  // mutual-reveal UI path is a separate, unconditional flow gated on
  // Match.status === MUTUAL, not on this policy.
  "match:seeIdentity": (s, r) => (s.role === "ORGANIZER" || s.role === "SUPERADMIN") && !!r.hasReportReference,

  "round:runPreviewPublish": (s) => s.role === "ORGANIZER" || s.role === "SUPERADMIN",
  "photo:approve": (s) => s.role === "ORGANIZER" || s.role === "SUPERADMIN",
  "report:handle": (s) => s.role === "ORGANIZER" || s.role === "SUPERADMIN",

  "account:suspendShort": (s) => s.role === "ORGANIZER" || s.role === "SUPERADMIN",
  "account:suspendAny": (s) => s.role === "SUPERADMIN",
  "account:ban": (s) => s.role === "SUPERADMIN",

  "config:editDatesAndCopy": (s) => s.role === "ORGANIZER" || s.role === "SUPERADMIN",
  "config:editAll": (s) => s.role === "SUPERADMIN",

  "data:exportAggregate": (s) => s.role === "ORGANIZER" || s.role === "SUPERADMIN",
  "data:exportFull": (s) => s.role === "SUPERADMIN",
  "data:wipeEvent": (s) => s.role === "SUPERADMIN",

  "organizer:manage": (s) => s.role === "SUPERADMIN",

  "chat:readForReport": (s, r) => (s.role === "ORGANIZER" || s.role === "SUPERADMIN") && !!r.hasReportReference,
};

/**
 * The one function every mutation must call before doing anything.
 * `can(user, "report:handle", {})` style.
 */
export function can(subject: PolicySubject, action: Action, resource: PolicyResource = {}): boolean {
  const policy = POLICIES[action];
  return policy(subject, resource);
}

export class ForbiddenError extends Error {
  constructor(action: Action) {
    super(`Not authorised to perform "${action}"`);
    this.name = "ForbiddenError";
  }
}

/** Throws ForbiddenError if the policy check fails — use at the top of any mutation. */
export function assertCan(subject: PolicySubject, action: Action, resource: PolicyResource = {}): void {
  if (!can(subject, action, resource)) {
    throw new ForbiddenError(action);
  }
}
