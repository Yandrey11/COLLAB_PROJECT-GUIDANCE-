/**
 * Display name for the SWEU recommendation signature (stored author, legacy field, or audit).
 * @param {object} record - Mongoose doc or plain object
 * @returns {string}
 */
export function resolveRecommendationAuthorName(record) {
  if (!record || typeof record !== "object") return "";
  const fromStored =
    record.recommendationAuthorName != null && String(record.recommendationAuthorName).trim();
  if (fromStored) return String(record.recommendationAuthorName).trim();
  const legacy = record.directorName != null && String(record.directorName).trim();
  if (legacy) return String(record.directorName).trim();
  const hist = record.auditTrail?.modificationHistory;
  if (Array.isArray(hist)) {
    for (let i = hist.length - 1; i >= 0; i--) {
      const e = hist[i];
      if (e?.field === "recommendation" && e?.changedBy?.userName) {
        const n = String(e.changedBy.userName).trim();
        if (n) return n;
      }
    }
  }
  return "";
}
