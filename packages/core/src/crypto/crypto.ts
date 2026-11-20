import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

function deriveKey(secret: string): Buffer {
  // scrypt with a fixed, documented salt: the secret itself is the real
  // entropy source (FIELD_ENCRYPTION_KEY, a generated 32+ byte random
  // string — see scripts/generate-secrets.ts), this just stretches it to
  // exactly 32 bytes for AES-256.
  return scryptSync(secret, "prommatch-field-encryption", 32);
}

/**
 * Encrypts a UTF-8 string for storage in an ENC-marked Prisma field.
 * Returns `iv:authTag:ciphertext`, all base64url, so it's a single opaque
 * string column-safe to store as text.
 */
export function encryptField(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64url"), authTag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecryptionError";
  }
}

/** Decrypts a string produced by encryptField. Throws DecryptionError on tamper/wrong key. */
export function decryptField(payload: string, secret: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) throw new DecryptionError("Malformed encrypted payload");
  const [ivB64, tagB64, dataB64] = parts as [string, string, string];

  const key = deriveKey(secret);
  const iv = Buffer.from(ivB64, "base64url");
  const authTag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    throw new DecryptionError("Failed to decrypt — wrong key or tampered payload");
  }
}

/**
 * Salted SHA-256 hash for comparisons that must never be reversible (e.g.
 * "never match me with this email" — we only ever need equality, not the
 * original value back). Not for passwords (there are none — auth is
 * passwordless) and not a substitute for encryptField where the plaintext
 * must be recoverable.
 */
export function hashForComparison(value: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${value.trim().toLowerCase()}`).digest("hex");
}
