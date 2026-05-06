import { decrypt, isEncrypted } from "./fieldCrypto.js";
import { decryptPlainObjectInPlace } from "./encryptedFieldsPlugin.js";
import { RECORD_ENCRYPTED_FIELD_PATHS } from "../models/Record.js";

function decryptNestedEncryptedStrings(value, depth = 0) {
  if (depth > 12 || value == null) return;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (typeof item === "string" && isEncrypted(item)) value[i] = decrypt(item);
      else decryptNestedEncryptedStrings(item, depth + 1);
    }
    return;
  }
  if (typeof value !== "object") return;
  for (const k of Object.keys(value)) {
    const v = value[k];
    if (typeof v === "string" && isEncrypted(v)) value[k] = decrypt(v);
    else decryptNestedEncryptedStrings(v, depth + 1);
  }
}

/** `oldValue` / `newValue` in audit history are Mixed and may hold ciphertext. */
function decryptModificationHistory(history) {
  if (!Array.isArray(history)) return;
  for (const entry of history) {
    if (!entry || typeof entry !== "object") continue;
    for (const key of ["oldValue", "newValue"]) {
      if (!(key in entry)) continue;
      const v = entry[key];
      if (typeof v === "string" && isEncrypted(v)) entry[key] = decrypt(v);
      else decryptNestedEncryptedStrings(v, 0);
    }
  }
}

/**
 * Return a client-safe plain object for encrypted Record fields (fixes lean / JSON paths
 * where ciphertext would otherwise be exposed).
 */
export function sanitizeRecordForApi(record) {
  if (record == null) return record;
  const obj =
    typeof record.toObject === "function"
      ? record.toObject({ depopulate: true, virtuals: false })
      : record;

  decryptPlainObjectInPlace(obj, RECORD_ENCRYPTED_FIELD_PATHS);
  decryptModificationHistory(obj.auditTrail?.modificationHistory);
  return obj;
}

export function sanitizeRecordsForApi(records) {
  if (!Array.isArray(records)) return records;
  return records.map((r) => sanitizeRecordForApi(r));
}
