/**
 * One-time, idempotent migration: encrypt-at-rest existing PII for
 * Counselor / GoogleUser / Admin / Record / CounselorNotification, and
 * (re)compute every deterministic HMAC lookup column.
 *
 * Usage:
 *   node scripts/encryptExistingData.js
 *
 * Safe to run multiple times: encrypt() is a no-op on already-encrypted
 * values (detects the `enc:v1:` prefix), and lookup HMACs are
 * deterministic, so re-running just re-confirms state.
 */

import "dotenv/config";
import mongoose from "mongoose";
import Counselor from "../models/Counselor.js";
import GoogleUser from "../models/GoogleUser.js";
import Admin from "../models/Admin.js";
import Record from "../models/Record.js";
import CounselorNotification from "../models/CounselorNotification.js";
import { encrypt, decrypt, hmac, isEncrypted } from "../utils/fieldCrypto.js";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URI_DIRECT;
if (!MONGO_URI) {
  console.error("❌ MONGO_URI (or MONGO_URI_DIRECT) is required");
  process.exit(1);
}

const ensureKey = () => {
  if (!process.env.FIELD_ENCRYPTION_KEY && !process.env.JWT_SECRET) {
    console.error("❌ FIELD_ENCRYPTION_KEY or JWT_SECRET must be set");
    process.exit(1);
  }
};

const stats = {
  Counselor: 0,
  GoogleUser: 0,
  Admin: 0,
  Record: 0,
  CounselorNotification: 0,
};

// Returns [encryptedValue, plainValue]. If already encrypted, decrypts once
// for hashing; otherwise encrypts the plain value.
function ensurePair(raw) {
  if (raw === null || raw === undefined || raw === "") return ["", ""];
  if (typeof raw !== "string") raw = String(raw);
  if (isEncrypted(raw)) return [raw, decrypt(raw)];
  return [encrypt(raw), raw];
}

function setPath(obj, path, value) {
  const segs = path.split(".");
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    if (cur[segs[i]] == null) cur[segs[i]] = {};
    cur = cur[segs[i]];
  }
  cur[segs[segs.length - 1]] = value;
}

function getPath(obj, path) {
  return path.split(".").reduce((cur, seg) => (cur == null ? undefined : cur[seg]), obj);
}

async function migrateAccountModel(Model, modelName, fields, lookups) {
  console.log(`▶ ${modelName}: scanning…`);
  const cursor = Model.collection.find({}); // raw cursor, bypasses plugin hooks
  let n = 0;
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const update = {};
    const plainCache = {};
    for (const f of fields) {
      const v = getPath(doc, f);
      if (v === null || v === undefined || v === "") continue;
      const [enc, plain] = ensurePair(v);
      plainCache[f] = plain;
      if (enc !== v) update[f] = enc;
    }
    for (const [target, cfg] of Object.entries(lookups)) {
      const sources = Array.isArray(cfg.from) ? cfg.from : [cfg.from];
      let plain;
      for (const src of sources) {
        const cached = plainCache[src];
        const raw = cached !== undefined ? cached : getPath(doc, src);
        if (raw && typeof raw === "string") {
          plain = isEncrypted(raw) ? decrypt(raw) : raw;
          if (plain) break;
        }
      }
      const desired = plain ? hmac(plain, cfg.normalize || "passthrough") : "";
      if (doc[target] !== desired) update[target] = desired;
    }
    if (Object.keys(update).length) {
      await Model.collection.updateOne({ _id: doc._id }, { $set: update });
      n += 1;
    }
  }
  stats[modelName] = n;
  console.log(`  ${modelName}: updated ${n} document(s)`);
}

async function migrateRecords() {
  console.log("▶ Record: scanning…");
  const fields = [
    "clientName",
    "counselor",
    "notes",
    "outcomes",
    "schoolYear",
    "gender",
    "college",
    "course",
    "yearLevel",
    "section",
    "problemsPresentedNotes",
    "problemsPresented",
    "remarks",
    "recommendation",
    "recommendationAuthorName",
    "driveLink",
    "googleCalendarEventId",
    "archivedBy.userName",
    "auditTrail.createdBy.userName",
    "auditTrail.lastModifiedBy.userName",
    "auditTrail.deletedBy.userName",
  ];
  const cursor = Record.collection.find({});
  let n = 0;
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const update = {};
    const plainCache = {};

    for (const f of fields) {
      const v = getPath(doc, f);
      if (v === null || v === undefined || v === "") continue;
      const [enc, plain] = ensurePair(v);
      plainCache[f] = plain;
      if (enc !== v) update[f] = enc;
    }

    // Arrays of subdocuments
    if (Array.isArray(doc.attachments)) {
      const newAttachments = doc.attachments.map((a) => {
        const out = { ...a };
        if (a?.fileName) {
          const [enc] = ensurePair(a.fileName);
          if (enc !== a.fileName) out.fileName = enc;
        }
        if (a?.fileUrl) {
          const [enc] = ensurePair(a.fileUrl);
          if (enc !== a.fileUrl) out.fileUrl = enc;
        }
        if (a?.uploadedBy) {
          const [enc] = ensurePair(a.uploadedBy);
          if (enc !== a.uploadedBy) out.uploadedBy = enc;
        }
        return out;
      });
      const changed = newAttachments.some((a, i) => {
        const orig = doc.attachments[i] || {};
        return (
          a.fileName !== orig.fileName ||
          a.fileUrl !== orig.fileUrl ||
          a.uploadedBy !== orig.uploadedBy
        );
      });
      if (changed) update.attachments = newAttachments;
    }

    if (doc.auditTrail?.modificationHistory?.length) {
      const newHistory = doc.auditTrail.modificationHistory.map((h) => {
        const out = { ...h };
        if (h?.changedBy?.userName) {
          const [enc] = ensurePair(h.changedBy.userName);
          if (enc !== h.changedBy.userName) {
            out.changedBy = { ...h.changedBy, userName: enc };
          }
        }
        return out;
      });
      const changed = newHistory.some(
        (h, i) =>
          h?.changedBy?.userName !==
          (doc.auditTrail.modificationHistory[i]?.changedBy?.userName ?? undefined)
      );
      if (changed) update["auditTrail.modificationHistory"] = newHistory;
    }

    // Lookup columns
    const counselorPlain =
      plainCache.counselor !== undefined
        ? plainCache.counselor
        : (() => {
            const v = doc.counselor;
            return isEncrypted(v) ? decrypt(v) : v || "";
          })();
    const clientPlain =
      plainCache.clientName !== undefined
        ? plainCache.clientName
        : (() => {
            const v = doc.clientName;
            return isEncrypted(v) ? decrypt(v) : v || "";
          })();
    const auditPlain =
      plainCache["auditTrail.createdBy.userName"] !== undefined
        ? plainCache["auditTrail.createdBy.userName"]
        : (() => {
            const v = doc.auditTrail?.createdBy?.userName;
            return isEncrypted(v) ? decrypt(v) : v || "";
          })();

    const desiredCounselorLookup = counselorPlain ? hmac(counselorPlain, "name") : "";
    const desiredClientLookup = clientPlain ? hmac(clientPlain, "name") : "";
    const desiredAuditLookup = auditPlain ? hmac(auditPlain, "name") : "";
    if (doc.counselorLookup !== desiredCounselorLookup) update.counselorLookup = desiredCounselorLookup;
    if (doc.clientNameLookup !== desiredClientLookup) update.clientNameLookup = desiredClientLookup;
    if (doc.auditCreatedByLookup !== desiredAuditLookup) update.auditCreatedByLookup = desiredAuditLookup;

    if (Object.keys(update).length) {
      await Record.collection.updateOne({ _id: doc._id }, { $set: update });
      n += 1;
    }
  }
  stats.Record = n;
  console.log(`  Record: updated ${n} document(s)`);
}

async function dropLegacyIndexes() {
  // Drop pre-encryption unique-on-email and other indexes that no longer apply.
  const drop = async (Model, name) => {
    try {
      await Model.collection.dropIndex(name);
      console.log(`  dropped index ${Model.modelName}.${name}`);
    } catch (e) {
      if (e?.codeName !== "IndexNotFound") {
        console.log(`  (skip ${Model.modelName}.${name}: ${e.message})`);
      }
    }
  };
  await drop(Counselor, "email_1");
  await drop(GoogleUser, "email_1");
  await drop(Admin, "email_1");
  await drop(Record, "clientName_1");
  await drop(Record, "counselor_1");
  await drop(CounselorNotification, "counselorEmail_1");
  await drop(CounselorNotification, "counselorEmail_1_status_1");
}

async function main() {
  ensureKey();
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB");

  const accountFields = ["name", "email", "phoneNumber", "bio", "profilePicture"];
  const accountLookups = {
    emailLookup: { from: "email", normalize: "email", unique: true },
    nameLookup: { from: "name", normalize: "name" },
  };

  await migrateAccountModel(Counselor, "Counselor", accountFields, accountLookups);
  await migrateAccountModel(GoogleUser, "GoogleUser", accountFields, accountLookups);
  await migrateAccountModel(Admin, "Admin", accountFields, accountLookups);

  await migrateRecords();

  await migrateAccountModel(
    CounselorNotification,
    "CounselorNotification",
    ["counselorEmail"],
    { counselorEmailLookup: { from: "counselorEmail", normalize: "email" } }
  );

  console.log("▶ dropping legacy indexes (if present)…");
  await dropLegacyIndexes();

  // Force the new indexes (lookup + uniqueness) into place.
  console.log("▶ syncing indexes…");
  await Promise.all([
    Counselor.syncIndexes(),
    GoogleUser.syncIndexes(),
    Admin.syncIndexes(),
    Record.syncIndexes(),
    CounselorNotification.syncIndexes(),
  ]);

  console.log("✅ Migration complete:", stats);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ Migration failed:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
