import { describe, expect, it } from "vitest";
import { decryptField, DecryptionError, encryptField, hashForComparison } from "./crypto.js";

const SECRET = "test-secret-at-least-32-bytes-long-ok";

describe("encryptField / decryptField", () => {
  it("round-trips plaintext", () => {
    const plaintext = "WOMAN";
    const encrypted = encryptField(plaintext, SECRET);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptField(encrypted, SECRET)).toBe(plaintext);
  });

  it("produces different ciphertext for the same plaintext each time (random IV)", () => {
    const a = encryptField("same value", SECRET);
    const b = encryptField("same value", SECRET);
    expect(a).not.toEqual(b);
  });

  it("detects tampering", () => {
    const encrypted = encryptField("sensitive", SECRET);
    const parts = encrypted.split(":");
    const tampered = [parts[0], parts[1], parts[2]?.slice(0, -2) + "zz"].join(":");
    expect(() => decryptField(tampered, SECRET)).toThrow(DecryptionError);
  });

  it("fails to decrypt with the wrong key", () => {
    const encrypted = encryptField("sensitive", SECRET);
    expect(() => decryptField(encrypted, "a-completely-different-secret-value")).toThrow(DecryptionError);
  });
});

describe("hashForComparison", () => {
  it("is deterministic and case/whitespace-insensitive", () => {
    const a = hashForComparison("Student@College.edu", "salt");
    const b = hashForComparison(" student@college.edu ", "salt");
    expect(a).toBe(b);
  });

  it("is salt-sensitive", () => {
    const a = hashForComparison("student@college.edu", "salt1");
    const b = hashForComparison("student@college.edu", "salt2");
    expect(a).not.toBe(b);
  });

  it("never contains the original value", () => {
    const hash = hashForComparison("secret@college.edu", "salt");
    expect(hash).not.toContain("secret");
  });
});
