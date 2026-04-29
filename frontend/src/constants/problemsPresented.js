/**
 * Standard “problems presented” categories (abbreviation + full name).
 * Stored on records as comma-separated codes, e.g. "HF, STR, C".
 */

export const PROBLEMS_PRESENTED_OPTIONS = [
  { code: "HF", label: "Home and Family" },
  { code: "HPC", label: "Health and Physical Concerns" },
  { code: "FLE", label: "Finances, Living Conditions, Employment" },
  { code: "SPR", label: "Social Psychological Relations" },
  { code: "PPR", label: "Personal – Psychological Relations" },
  { code: "CSM", label: "Courtship, Sex, Marriage" },
  { code: "MR", label: "Morals and Religion" },
  { code: "ASW", label: "Adjustment to School Work" },
  { code: "C", label: "Career" },
  { code: "CTP", label: "Curriculum and Teaching Procedure" },
  { code: "STR", label: "Student / Teacher relationship" },
];

const ORDER_INDEX = Object.fromEntries(
  PROBLEMS_PRESENTED_OPTIONS.map((o, i) => [o.code, i])
);

const BY_UPPER = new Map(
  PROBLEMS_PRESENTED_OPTIONS.map((o) => [o.code.toUpperCase(), o])
);

/**
 * @returns {{ codes: string[]; rest: string }} Known codes (sorted) and other comma-separated text (legacy or notes).
 */
export function parseProblemsPresentedParts(raw) {
  if (!raw || typeof raw !== "string") return { codes: [], rest: "" };
  const parts = raw.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  const seenCodes = new Set();
  const codes = [];
  const other = [];
  for (const p of parts) {
    const opt = BY_UPPER.get(p.toUpperCase());
    if (opt && !seenCodes.has(opt.code)) {
      seenCodes.add(opt.code);
      codes.push(opt.code);
    } else if (!opt) {
      other.push(p);
    }
  }
  return { codes: sortProblemsCodes(codes), rest: other.join(", ") };
}

/** @returns {string[]} canonical codes in taxonomy order */
export function parseProblemsCodes(raw) {
  return parseProblemsPresentedParts(raw).codes;
}

/** @param {string[]} codes @param {string} [rest] */
export function mergeProblemsPresented(codes, rest) {
  const c = serializeProblemsCodes(codes || []);
  const r = (rest || "").trim();
  if (c && r) return `${c}, ${r}`;
  return c || r || "";
}

/** @param {string[]} codes */
export function sortProblemsCodes(codes) {
  return [...new Set(codes)].sort(
    (a, b) => (ORDER_INDEX[a] ?? 999) - (ORDER_INDEX[b] ?? 999)
  );
}

/** @param {string[]} codes */
export function serializeProblemsCodes(codes) {
  return sortProblemsCodes(codes.filter(Boolean)).join(", ");
}

/** Build merged string from API record fields (structured or legacy). */
export function composeProblemsPresentedString(recordLike) {
  if (!recordLike || typeof recordLike !== "object") return "";
  const hasStructured =
    (Array.isArray(recordLike.problemsPresentedCodes) &&
      recordLike.problemsPresentedCodes.length > 0) ||
    (recordLike.problemsPresentedNotes != null &&
      String(recordLike.problemsPresentedNotes).trim() !== "");
  if (hasStructured) {
    return mergeProblemsPresented(
      recordLike.problemsPresentedCodes || [],
      recordLike.problemsPresentedNotes != null ? recordLike.problemsPresentedNotes : ""
    );
  }
  return typeof recordLike.problemsPresented === "string" ? recordLike.problemsPresented : "";
}

/** Value for checkbox UI from a record returned by the API */
export function problemsPresentedFieldValue(record) {
  if (!record) return "";
  return composeProblemsPresentedString(record) || (record.problemsPresented || "");
}

/** Human-readable line for UI/PDF; pass a string or a record object. */
export function formatProblemsPresentedDisplay(rawOrRecord) {
  const line =
    typeof rawOrRecord === "string"
      ? rawOrRecord
      : composeProblemsPresentedString(rawOrRecord);
  if (!line || !String(line).trim()) return "—";
  const { codes, rest } = parseProblemsPresentedParts(String(line));
  const main = codes
    .map((code) => {
      const opt = PROBLEMS_PRESENTED_OPTIONS.find((o) => o.code === code);
      return opt ? `${opt.code} — ${opt.label}` : code;
    })
    .join("; ");
  const r = rest.trim();
  if (r) return main ? `${main}; ${r}` : r;
  return main || "—";
}
