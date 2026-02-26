import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PREFIX = "enc:";

// Derive a 32-byte key from env secret
function getKey() {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("TOKEN_ENCRYPTION_KEY or JWT_SECRET must be set for token encryption");
  }
  return crypto.scryptSync(secret, "token-salt", KEY_LENGTH);
}

/**
 * Encrypt a plain string for secure storage in DB.
 * Returns "enc:base64(iv:authTag:ciphertext)" or null for empty input.
 */
export function encryptToken(plain) {
  if (!plain || typeof plain !== "string") return plain;
  try {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return PREFIX + combined.toString("base64");
  } catch (err) {
    console.error("Token encryption failed:", err.message);
    return plain; // Fallback to plain on error (e.g. during migration)
  }
}

/**
 * Decrypt a stored string. Returns plain text.
 * Handles legacy plain (unencrypted) values for backward compatibility.
 */
export function decryptToken(stored) {
  if (!stored || typeof stored !== "string") return stored;
  if (!stored.startsWith(PREFIX)) return stored; // Legacy plain value
  try {
    const key = getKey();
    const combined = Buffer.from(stored.slice(PREFIX.length), "base64");
    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) return stored;
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final("utf8");
  } catch (err) {
    console.error("Token decryption failed:", err.message);
    return stored; // Return as-is on error (e.g. wrong key or corrupted)
  }
}
