import { describe, expect, it } from "vitest";
import { isAllowed, moderateText, normalise } from "./filter.js";

describe("normalise", () => {
  it("maps common leetspeak substitutions", () => {
    expect(normalise("s3x")).toBe("sex");
    expect(normalise("k1ll")).toBe("kill");
  });

  it("collapses spaced-out letters used to evade matching", () => {
    expect(normalise("f u c k")).toBe("fuck");
    expect(normalise("f.u.c.k")).toBe("fuck");
  });
});

describe("moderateText", () => {
  it("blocks a direct threat", () => {
    const result = moderateText("I will kill you");
    expect(result.severity).toBe("block");
    expect(isAllowed(result)).toBe(false);
  });

  it("blocks self-harm-directed harassment, including evasive spelling", () => {
    expect(moderateText("just kys already").severity).toBe("block");
    expect(moderateText("k y s").severity).toBe("block");
  });

  it("flags but does not block mild profanity", () => {
    const result = moderateText("what the fuck was that");
    expect(result.severity).toBe("flag");
    expect(isAllowed(result)).toBe(true);
  });

  it("passes ordinary, friendly text clean", () => {
    const result = moderateText("Hey! Excited for prom, want to grab food before?");
    expect(result.severity).toBe("ok");
    expect(result.categories).toHaveLength(0);
  });

  it("does not false-positive on common words containing substrings", () => {
    // "class" contains no blocked pattern; sanity check normalise doesn't
    // over-collapse into one.
    const result = moderateText("See you in class after the assembly");
    expect(result.severity).toBe("ok");
  });
});
