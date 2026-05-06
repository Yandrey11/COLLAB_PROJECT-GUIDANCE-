import crypto from "crypto";

// Application-level field encryption helpers used by the encryptedFieldsPlugin
// and the one-shot migration script. Format on disk:
//
//     enc:v1:<base64Iv>:<base64Tag>:<base64Cipher>
//
// AES-256-GCM, 12-byte IV, 16-byte auth tag. The same key derives the
// HMAC used for deterministic "lookup" shadow columns so equality search
// (login by email, scope match by counselor name) keeps working without
// exposing plaintext to MongoDB.

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const VERSION = "v1";
const PREFIX = `enc:${VERSION}:`;

let cachedKey = null;
let cachedHmacKey = null;

function getKey() {
  if (cachedKey) return cachedKey;
  const explicit = process.env.FIELD_ENCRYPTION_KEY;
  if (explicit && /^[0-9a-f]{64}$/i.test(explicit)) {
    cachedKey = Buffer.from(explicit, "hex");
    return cachedKey;
  }
  const secret = explicit || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY (or JWT_SECRET fallback) must be set for field encryption"
    );
  }
  cachedKey = crypto.scryptSync(secret, "field-encryption", KEY_LENGTH);
  return cachedKey;
}

function getHmacKey() {
  if (cachedHmacKey) return cachedHmacKey;
  const secret = process.env.FIELD_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "FIELD_ENCRYPTION_KEY (or JWT_SECRET fallback) must be set for field hashing"
    );
  }
  cachedHmacKey = crypto.scryptSync(secret, "field-hmac", KEY_LENGTH);
  return cachedHmacKey;
}

export function isEncrypted(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encrypt(plain) {
  if (plain === null || plain === undefined) return plain;
  if (typeof plain !== "string") plain = String(plain);
  if (plain === "") return plain;
  if (isEncrypted(plain)) return plain;
  try {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      "enc",
      VERSION,
      iv.toString("base64"),
      tag.toString("base64"),
      encrypted.toString("base64"),
    ].join(":");
  } catch (err) {
    console.error("[fieldCrypto] encrypt failed:", err.message);
    return plain;
  }
}

export function decrypt(stored) {
  if (stored === null || stored === undefined) return stored;
  if (typeof stored !== "string") return stored;
  if (!isEncrypted(stored)) return stored;
  try {
    const parts = stored.split(":");
    // ["enc", "v1", iv, tag, cipher]
    if (parts.length !== 5) return stored;
    const iv = Buffer.from(parts[2], "base64");
    const tag = Buffer.from(parts[3], "base64");
    const cipherBuf = Buffer.from(parts[4], "base64");
    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(cipherBuf), decipher.final()]);
    return dec.toString("utf8");
  } catch (err) {
    console.error("[fieldCrypto] decrypt failed:", err.message);
    return stored;
  }
}

export function normalizeEmail(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
}

export function normalizeName(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizePassthrough(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

const NORMALIZERS = {
  email: normalizeEmail,
  name: normalizeName,
  passthrough: normalizePassthrough,
};

export function getNormalizer(kind) {
  return NORMALIZERS[kind] || NORMALIZERS.passthrough;
}

/**
 * Deterministic HMAC of a normalized value, used as a "blind index" lookup
 * column. Returns "" for empty input so unique indexes can still allow
 * documents without that field.
 */
export function hmac(value, kind = "passthrough") {
  const normalized = getNormalizer(kind)(value);
  if (!normalized) return "";
  return crypto.createHmac("sha256", getHmacKey()).update(normalized).digest("hex");
}
