/**
 * Same taxonomy as frontend `constants/problemsPresented.js` (PDF + DB normalization).
 */

const PROBLEMS_PRESENTED_OPTIONS = [
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

/** Allowed codes for Mongoose `enum` on array elements */
export const PROBLEMS_PRESENTED_CODE_ENUM = PROBLEMS_PRESENTED_OPTIONS.map((o) => o.code);

const ORDER_INDEX = Object.fromEntries(
  PROBLEMS_PRESENTED_OPTIONS.map((o, i) => [o.code, i])
);

const BY_UPPER = new Map(
  PROBLEMS_PRESENTED_OPTIONS.map((o) => [o.code.toUpperCase(), o])
);

function sortProblemsCodes(codes) {
  return [...new Set(codes)].sort(
    (a, b) => (ORDER_INDEX[a] ?? 999) - (ORDER_INDEX[b] ?? 999)
  );
}

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

export function mergeProblemsPresented(codes, rest) {
  const c = sortProblemsCodes((codes || []).filter(Boolean)).join(", ");
  const r = (rest != null ? String(rest) : "").trim();
  if (c && r) return `${c}, ${r}`;
  return c || r || "";
}

/** Keep only taxonomy codes, deduped, sorted */
export function filterValidProblemsCodes(arr) {
  if (!Array.isArray(arr)) return [];
  const allowed = new Set(PROBLEMS_PRESENTED_CODE_ENUM);
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const token = String(x).trim().toUpperCase();
    const opt = BY_UPPER.get(token);
    if (opt && allowed.has(opt.code) && !seen.has(opt.code)) {
      seen.add(opt.code);
      out.push(opt.code);
    }
  }
  return sortProblemsCodes(out);
}

/**
 * Derive `problemsPresentedCodes`, `problemsPresentedNotes`, and legacy `problemsPresented` string from request body.
 * Prefers `problemsPresentedCodes` + `problemsPresentedNotes` when the array key is present.
 */
export function normalizeProblemsPresentedFromBody(body) {
  if (!body || typeof body !== "object") {
    return { problemsPresentedCodes: [], problemsPresentedNotes: "", problemsPresented: "" };
  }

  let codes = [];
  let notes = "";

  if (Object.prototype.hasOwnProperty.call(body, "problemsPresentedCodes")) {
    codes = filterValidProblemsCodes(body.problemsPresentedCodes);
    notes =
      typeof body.problemsPresentedNotes === "string"
        ? body.problemsPresentedNotes
        : body.problemsPresentedNotes != null
          ? String(body.problemsPresentedNotes)
          : "";
  } else if (body.problemsPresented != null && typeof body.problemsPresented === "string") {
    const parsed = parseProblemsPresentedParts(body.problemsPresented);
    codes = parsed.codes;
    notes = parsed.rest;
  }

  const problemsPresented = mergeProblemsPresented(codes, notes);
  return { problemsPresentedCodes: codes, problemsPresentedNotes: notes, problemsPresented };
}

/** For PDF / display: prefer structured fields when present */
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

export function formatProblemsPresentedDisplay(raw) {
  const line =
    typeof raw === "string"
      ? raw
      : composeProblemsPresentedString(raw);
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
