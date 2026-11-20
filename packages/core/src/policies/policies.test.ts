import { describe, expect, it } from "vitest";
import { can, type Action, type PolicyResource, type PolicySubject, type Role } from "./policies.js";

const roles: Role[] = ["STUDENT", "ORGANIZER", "SUPERADMIN"];

function subject(role: Role): PolicySubject {
  return { role, userId: "me" };
}

/**
 * Table-driven test of the full permissions matrix from spec section 6.
 * Each row: action, resource context, then expected result per role.
 */
const matrix: {
  action: Action;
  resource?: PolicyResource;
  expected: Record<Role, boolean>;
}[] = [
  {
    action: "profile:editOwn",
    resource: { ownerId: "me" },
    expected: { STUDENT: true, ORGANIZER: true, SUPERADMIN: true },
  },
  {
    action: "profile:editOwn",
    resource: { ownerId: "someone-else" },
    expected: { STUDENT: false, ORGANIZER: false, SUPERADMIN: false },
  },
  {
    action: "match:seeIdentity",
    resource: { hasReportReference: true },
    expected: { STUDENT: false, ORGANIZER: true, SUPERADMIN: true },
  },
  {
    action: "match:seeIdentity",
    resource: { hasReportReference: false },
    expected: { STUDENT: false, ORGANIZER: false, SUPERADMIN: false },
  },
  {
    action: "round:runPreviewPublish",
    expected: { STUDENT: false, ORGANIZER: true, SUPERADMIN: true },
  },
  {
    action: "photo:approve",
    expected: { STUDENT: false, ORGANIZER: true, SUPERADMIN: true },
  },
  {
    action: "report:handle",
    expected: { STUDENT: false, ORGANIZER: true, SUPERADMIN: true },
  },
  {
    action: "account:suspendShort",
    expected: { STUDENT: false, ORGANIZER: true, SUPERADMIN: true },
  },
  {
    action: "account:suspendAny",
    expected: { STUDENT: false, ORGANIZER: false, SUPERADMIN: true },
  },
  {
    action: "account:ban",
    expected: { STUDENT: false, ORGANIZER: false, SUPERADMIN: true },
  },
  {
    action: "config:editDatesAndCopy",
    expected: { STUDENT: false, ORGANIZER: true, SUPERADMIN: true },
  },
  {
    action: "config:editAll",
    expected: { STUDENT: false, ORGANIZER: false, SUPERADMIN: true },
  },
  {
    action: "data:exportAggregate",
    expected: { STUDENT: false, ORGANIZER: true, SUPERADMIN: true },
  },
  {
    action: "data:exportFull",
    expected: { STUDENT: false, ORGANIZER: false, SUPERADMIN: true },
  },
  {
    action: "data:wipeEvent",
    expected: { STUDENT: false, ORGANIZER: false, SUPERADMIN: true },
  },
  {
    action: "organizer:manage",
    expected: { STUDENT: false, ORGANIZER: false, SUPERADMIN: true },
  },
  {
    action: "chat:readForReport",
    resource: { hasReportReference: true },
    expected: { STUDENT: false, ORGANIZER: true, SUPERADMIN: true },
  },
];

describe("permissions matrix (spec section 6)", () => {
  for (const row of matrix) {
    for (const role of roles) {
      const expected = row.expected[role];
      it(`${row.action} / ${JSON.stringify(row.resource ?? {})} / ${role} => ${expected}`, () => {
        expect(can(subject(role), row.action, row.resource)).toBe(expected);
      });
    }
  }
});
