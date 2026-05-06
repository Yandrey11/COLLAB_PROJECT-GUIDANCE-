import Counselor from "../models/Counselor.js";
import GoogleUser from "../models/GoogleUser.js";
import Admin from "../models/Admin.js";
import { hmac } from "./fieldCrypto.js";

// Centralized helpers for "look up an account by email" against the encrypted
// columns. The plaintext `email` field is now ciphertext, so equality has to
// go through the deterministic `emailLookup` HMAC.

export function emailLookupHash(email) {
  return hmac(email, "email");
}

export function emailLookupQuery(email) {
  return { emailLookup: emailLookupHash(email) };
}

export async function findCounselorByEmail(email, projection, options) {
  if (!email) return null;
  return Counselor.findOne(emailLookupQuery(email), projection, options);
}

export async function findGoogleUserByEmail(email, projection, options) {
  if (!email) return null;
  return GoogleUser.findOne(emailLookupQuery(email), projection, options);
}

export async function findAdminByEmail(email, extra = {}, projection, options) {
  if (!email) return null;
  return Admin.findOne({ ...emailLookupQuery(email), ...extra }, projection, options);
}

export async function findAnyUserByEmail(email) {
  if (!email) return { admin: null, counselor: null, googleUser: null };
  const [admin, counselor, googleUser] = await Promise.all([
    findAdminByEmail(email),
    findCounselorByEmail(email),
    findGoogleUserByEmail(email),
  ]);
  return { admin, counselor, googleUser };
}

/**
 * Restrict Record queries to rows owned by the current counselor. Encrypted
 * `counselor` / audit userName are not queryable by plaintext — use lookup HMACs.
 * Returns null for admin (no restriction).
 */
export function recordCounselorScopeFilter(req) {
  const user = req.user || req.admin;
  if (!user) return { _id: { $exists: false } };
  if (user.role === "admin" || user.permissions?.is_admin === true) return null;
  const userName = (user.name && String(user.name).trim()) || "";
  const userEmail = (user.email && String(user.email).trim()) || "";
  const tokens = [hmac(userName, "name"), hmac(userEmail, "name")].filter(Boolean);
  if (tokens.length === 0) return { _id: { $exists: false } };
  return {
    $or: [
      { counselorLookup: { $in: tokens } },
      { auditCreatedByLookup: { $in: tokens } },
    ],
  };
}
