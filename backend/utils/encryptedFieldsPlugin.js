import { encrypt, decrypt, hmac, isEncrypted, getNormalizer } from "./fieldCrypto.js";

// Mongoose plugin that transparently encrypts a configured list of string
// paths and maintains deterministic HMAC "lookup" shadow fields. Works for
// both regular Document writes and `findOneAndUpdate` / `updateOne` updates,
// and decrypts on read for both hydrated documents AND `.lean()` results.
//
// Path syntax mirrors Mongoose path strings:
//   "email"
//   "auditTrail.createdBy.userName"
//   "attachments.fileName"               (array of subdocs -> applied to every entry)
//   "auditTrail.modificationHistory.oldValue"
//
// Lookup config:
//   lookups: {
//     emailLookup: { from: "email", normalize: "email", unique: true },
//     auditCreatedByLookup: { from: ["auditTrail.createdBy.userName"], normalize: "name" }
//   }
// `from` may be a string or an array; when array, the lookup stores the HMAC
// of the first non-empty source after normalization (used so audit lookup can
// fall back across multiple legacy keys).

function getAt(obj, segments) {
  if (obj == null) return undefined;
  let cur = obj;
  for (const seg of segments) {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) return cur.map((item) => getAt(item, segments.slice(segments.indexOf(seg))));
    cur = cur[seg];
  }
  return cur;
}

function setAt(obj, segments, value) {
  if (obj == null) return;
  let cur = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (cur[seg] == null) cur[seg] = {};
    cur = cur[seg];
  }
  cur[segments[segments.length - 1]] = value;
}

// Walk a path through plain objects and arrays; for every leaf string,
// invoke `transform(value)` and set the result back. Arrays in the middle
// are traversed entry-by-entry.
function transformPath(root, segments, transform) {
  if (root == null || segments.length === 0) return;

  const apply = (node, idx) => {
    if (node == null) return;
    if (idx === segments.length) return;
    const seg = segments[idx];
    const last = idx === segments.length - 1;

    if (Array.isArray(node)) {
      for (const item of node) apply(item, idx);
      return;
    }

    const next = node[seg];
    if (last) {
      if (Array.isArray(next)) {
        node[seg] = next.map((v) => transform(v));
      } else {
        node[seg] = transform(next);
      }
      return;
    }

    if (Array.isArray(next)) {
      for (const item of next) apply(item, idx + 1);
    } else if (next && typeof next === "object") {
      apply(next, idx + 1);
    }
  };

  apply(root, 0);
}

function readFirstString(root, segments) {
  let found;
  const visit = (node, idx) => {
    if (node == null || found !== undefined) return;
    if (idx === segments.length) {
      if (typeof node === "string" && node !== "") found = node;
      return;
    }
    const seg = segments[idx];
    if (Array.isArray(node)) {
      for (const item of node) visit(item, idx);
      return;
    }
    if (typeof node !== "object") return;
    visit(node[seg], idx + 1);
  };
  visit(root, 0);
  return found;
}

function decryptInPlace(doc, fieldPaths) {
  if (!doc) return doc;
  for (const field of fieldPaths) {
    transformPath(doc, field.split("."), (v) => (typeof v === "string" ? decrypt(v) : v));
  }
  return doc;
}

/** Decrypt configured dotted paths on a plain object (e.g. API JSON). */
export function decryptPlainObjectInPlace(obj, fieldPaths) {
  if (!obj || !fieldPaths?.length) return;
  decryptInPlace(obj, fieldPaths);
}

function encryptInPlace(doc, fieldPaths) {
  if (!doc) return doc;
  for (const field of fieldPaths) {
    transformPath(doc, field.split("."), (v) =>
      typeof v === "string" && v !== "" ? encrypt(v) : v
    );
  }
  return doc;
}

function recomputeLookups(doc, lookups) {
  if (!doc || !lookups) return;
  for (const [target, cfg] of Object.entries(lookups)) {
    const sources = Array.isArray(cfg.from) ? cfg.from : [cfg.from];
    let raw;
    for (const src of sources) {
      const segs = src.split(".");
      raw = readFirstString(doc, segs);
      if (raw && isEncrypted(raw)) raw = decrypt(raw);
      if (raw) break;
    }
    doc[target] = raw ? hmac(raw, cfg.normalize || "passthrough") : "";
  }
}

// Build a structure usable by setter ops (`$set`, top-level update doc, etc).
function applyToUpdate(update, fieldPaths, lookups) {
  if (!update || typeof update !== "object") return update;

  const targets = [update];
  if (update.$set && typeof update.$set === "object") targets.push(update.$set);
  if (update.$setOnInsert && typeof update.$setOnInsert === "object")
    targets.push(update.$setOnInsert);

  for (const target of targets) {
    for (const field of fieldPaths) {
      // direct dotted key, e.g. "$set": { "email": "x" }
      if (target[field] !== undefined) {
        const v = target[field];
        if (typeof v === "string" && v !== "" && !isEncrypted(v)) {
          target[field] = encrypt(v);
        } else if (Array.isArray(v)) {
          target[field] = v.map((x) =>
            typeof x === "string" && x !== "" && !isEncrypted(x) ? encrypt(x) : x
          );
        }
        continue;
      }
      // nested object form, e.g. "$set": { auditTrail: { createdBy: { userName: "x" } } }
      transformPath(target, field.split("."), (v) =>
        typeof v === "string" && v !== "" && !isEncrypted(v) ? encrypt(v) : v
      );
    }
  }

  if (lookups) {
    // Populate lookup fields when their source field is being written. We try
    // both the merged-update view and any explicit value.
    const merged = { ...update, ...(update.$set || {}) };
    for (const [target, cfg] of Object.entries(lookups)) {
      const sources = Array.isArray(cfg.from) ? cfg.from : [cfg.from];
      let raw;
      let touched = false;
      for (const src of sources) {
        const segs = src.split(".");
        // direct dotted key
        if (Object.prototype.hasOwnProperty.call(merged, src)) {
          touched = true;
          raw = merged[src];
          if (raw && isEncrypted(raw)) raw = decrypt(raw);
          break;
        }
        const nested = readFirstString(merged, segs);
        if (nested) {
          touched = true;
          raw = isEncrypted(nested) ? decrypt(nested) : nested;
          break;
        }
      }
      if (!touched) continue;
      const value = raw ? hmac(raw, cfg.normalize || "passthrough") : "";
      if (update.$set) update.$set[target] = value;
      else update[target] = value;
    }
  }

  return update;
}

export default function encryptedFieldsPlugin(schema, options = {}) {
  const fields = options.fields || [];
  const lookups = options.lookups || {};

  // Add lookup paths to the schema (string + index per config).
  for (const [target, cfg] of Object.entries(lookups)) {
    if (schema.path(target)) continue;
    schema.add({
      [target]: {
        type: String,
        index: cfg.unique ? { unique: true, sparse: true } : true,
        default: "",
      },
    });
  }

  schema.pre("save", function preSaveEncrypt(next) {
    try {
      // Only mutate fields that are actually modified to avoid double-encrypt.
      const doc = this;
      const obj = doc.toObject({ depopulate: true, virtuals: false, transform: false });
      // Ensure we read the latest pre-save values.
      for (const field of fields) {
        if (doc.isModified(field)) {
          transformPath(obj, field.split("."), (v) =>
            typeof v === "string" && v !== "" && !isEncrypted(v) ? encrypt(v) : v
          );
          // Write back into the document.
          const segs = field.split(".");
          // For the simple top-level case, set directly. For nested, walk via Mongoose set().
          if (segs.length === 1) {
            const v = doc[segs[0]];
            if (Array.isArray(v)) {
              doc[segs[0]] = v.map((x) =>
                typeof x === "string" && x !== "" && !isEncrypted(x) ? encrypt(x) : x
              );
            } else if (typeof v === "string" && v !== "" && !isEncrypted(v)) {
              doc[segs[0]] = encrypt(v);
            }
          } else {
            // Encrypt nested values directly on the doc's JS structure.
            transformPath(doc, segs, (v) =>
              typeof v === "string" && v !== "" && !isEncrypted(v) ? encrypt(v) : v
            );
            doc.markModified(segs[0]);
          }
        }
      }
      // Recompute lookups using a decrypted view.
      const decView = doc.toObject({ depopulate: true, virtuals: false, transform: false });
      decryptInPlace(decView, fields);
      const computed = {};
      recomputeLookups(decView, lookups);
      for (const target of Object.keys(lookups)) {
        computed[target] = decView[target] || "";
        if (doc[target] !== computed[target]) doc[target] = computed[target];
      }
      next();
    } catch (err) {
      next(err);
    }
  });

  schema.pre(["findOneAndUpdate", "updateOne", "updateMany"], function preUpdateEncrypt(next) {
    try {
      const update = this.getUpdate();
      if (update) applyToUpdate(update, fields, lookups);
      next();
    } catch (err) {
      next(err);
    }
  });

  // Decrypt on read. Mongoose runs `post('find')` with an array, `post('findOne')`
  // and `post('findOneAndUpdate')` with a single doc. Works for both hydrated
  // documents and `.lean()` plain objects.
  const decryptHook = function decryptHook(res) {
    if (!res) return;
    const list = Array.isArray(res) ? res : [res];
    for (const entry of list) decryptInPlace(entry, fields);
  };

  schema.post("find", decryptHook);
  schema.post("findOne", decryptHook);
  schema.post("findOneAndUpdate", decryptHook);
  schema.post("findOneAndDelete", decryptHook);

  // Helper to compute lookup values for ad-hoc queries. Exposed on the model.
  schema.statics.encryptedLookup = function encryptedLookup(targetField, value) {
    const cfg = lookups[targetField];
    if (!cfg) return hmac(value);
    return hmac(value, cfg.normalize || "passthrough");
  };

  schema.statics.findByLookup = function findByLookup(targetField, value, projection, options) {
    const cfg = lookups[targetField];
    const norm = cfg ? cfg.normalize || "passthrough" : "passthrough";
    return this.findOne({ [targetField]: hmac(value, norm) }, projection, options);
  };
}

export { hmac, encrypt, decrypt, isEncrypted, getNormalizer };
