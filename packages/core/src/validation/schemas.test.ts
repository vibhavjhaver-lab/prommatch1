import { describe, expect, it } from "vitest";
import { isAllowedCollegeEmail, PrefsInputSchema } from "./schemas.js";

describe("isAllowedCollegeEmail", () => {
  it("accepts an email on the allowed domain", () => {
    expect(isAllowedCollegeEmail("student@college.edu", ["college.edu"])).toBe(true);
  });

  it("rejects an email on a different domain", () => {
    expect(isAllowedCollegeEmail("student@gmail.com", ["college.edu"])).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isAllowedCollegeEmail("Student@College.EDU", ["college.edu"])).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(isAllowedCollegeEmail("not-an-email", ["college.edu"])).toBe(false);
  });
});

describe("PrefsInputSchema", () => {
  it("rejects more than 3 dealbreakers", () => {
    const result = PrefsInputSchema.safeParse({
      modes: ["DATE"],
      gender: "WOMAN",
      yearMin: 1,
      yearMax: 5,
      dealbreakers: { a: ["x"], b: ["x"], c: ["x"], d: ["x"] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects yearMin > yearMax", () => {
    const result = PrefsInputSchema.safeParse({
      modes: ["DATE"],
      gender: "WOMAN",
      yearMin: 4,
      yearMax: 2,
      dealbreakers: {},
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid payload", () => {
    const result = PrefsInputSchema.safeParse({
      modes: ["DATE", "FRIEND"],
      gender: "WOMAN",
      seekingGenders: ["MAN"],
      yearMin: 1,
      yearMax: 5,
      dealbreakers: { substance: ["none"] },
    });
    expect(result.success).toBe(true);
  });
});
