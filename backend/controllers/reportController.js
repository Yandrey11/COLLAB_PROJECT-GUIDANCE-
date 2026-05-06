// controllers/reportController.js
import Record from "../models/Record.js";
import { createNotification } from "./admin/notificationController.js";
import { notArchivedFilter } from "../config/recordArchive.js";
import { recordCounselorScopeFilter } from "../utils/userLookup.js";
import { sanitizeRecordsForApi } from "../utils/recordApiSanitize.js";

const counselorScopeFilter = recordCounselorScopeFilter;

const filterByClientNameNeedle = (records, needle) => {
  if (!needle) return records;
  const n = String(needle).toLowerCase();
  return records.filter((r) => (r.clientName || "").toLowerCase().includes(n));
};

function buildReportsQuery(req, extra = {}) {
  // clientName is encrypted at rest; we filter on it after decrypt.
  const { startDate, endDate } = extra;
  const parts = [notArchivedFilter()];
  if (startDate && endDate) {
    parts.push({ date: { $gte: new Date(startDate), $lte: new Date(endDate) } });
  }
  const scope = counselorScopeFilter(req);
  if (scope) parts.push(scope);
  if (parts.length === 1) return parts[0];
  return { $and: parts };
}

// ✅ Get reports for the current counselor (or all, for admins) — optional client/date filters
export const getReports = async (req, res) => {
  try {
    const { clientName, startDate, endDate } = req.query;
    const query = buildReportsQuery(req, { startDate, endDate });
    const reports = sanitizeRecordsForApi(
      await Record.find(query).sort({ date: -1 }).lean()
    );
    res.status(200).json(filterByClientNameNeedle(reports, clientName));
  } catch (err) {
    console.error("❌ Error fetching reports:", err);
    res.status(500).json({ message: "Failed to fetch reports" });
  }
};

// ✅ Generate a comprehensive report for a client
export const generateReport = async (req, res) => {
  console.log("📥 Incoming report request body:", req.body);

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ message: "Request body missing or not JSON" });
  }

  const { clientName, startDate, endDate } = req.body;

  if (!clientName) {
    return res.status(400).json({ message: "Client name is required" });
  }

  try {
    const parts = [notArchivedFilter()];
    if (startDate && endDate) {
      parts.push({ date: { $gte: new Date(startDate), $lte: new Date(endDate) } });
    }
    const scope = counselorScopeFilter(req);
    if (scope) parts.push(scope);
    const query = parts.length === 1 ? parts[0] : { $and: parts };

    const allSessions = sanitizeRecordsForApi(await Record.find(query).lean());
    const sessions = filterByClientNameNeedle(allSessions, clientName);

    if (!sessions.length) {
      return res.status(404).json({ message: "No sessions found for this client" });
    }

    const summary = {
      clientName,
      totalSessions: sessions.length,
      completed: sessions.filter(s => s.status === "Completed").length,
      ongoing: sessions.filter(s => s.status === "Ongoing").length,
      referred: sessions.filter(s => s.status === "Referred").length,
      notesSummary: sessions.map(s => s.notes).filter(Boolean),
      outcomes: sessions.map(s => s.outcomes).filter(Boolean),
    };

    // ✅ Create notification for admin about report generation
    try {
      const userRole = req.user?.role || "counselor";
      const userName = req.user?.name || req.user?.email || "Unknown User";
      
      await createNotification({
        title: "Report Generated",
        description: `${userName} (${userRole}) has generated a report for client: ${clientName}. Total sessions: ${sessions.length}`,
        category: "User Activity",
        priority: "medium",
        metadata: {
          clientName,
          totalSessions: sessions.length,
          generatedBy: userName,
          generatedByRole: userRole,
          startDate: startDate || null,
          endDate: endDate || null,
        },
        relatedId: clientName,
        relatedType: "report",
      });
    } catch (notificationError) {
      console.error("⚠️ Notification creation failed (non-critical):", notificationError);
      // Continue with report generation even if notification creation fails
    }

    res.status(200).json({
      message: "✅ Report generated successfully",
      report: summary,
      sessions,
    });
  } catch (err) {
    console.error("❌ Error generating report:", err);
    res.status(500).json({ message: "Error generating report" });
  }
};

// ✅ Get single client report
export const getClientReport = async (req, res) => {
  try {
    const { clientName } = req.params;
    const parts = [notArchivedFilter()];
    const scope = counselorScopeFilter(req);
    if (scope) parts.push(scope);
    const query = parts.length === 1 ? parts[0] : { $and: parts };
    const allRecords = sanitizeRecordsForApi(await Record.find(query).lean());
    const records = filterByClientNameNeedle(allRecords, clientName);

    if (!records.length) {
      return res.status(404).json({ message: "No report found for this client" });
    }

    res.status(200).json(records);
  } catch (err) {
    console.error("❌ Error fetching client report:", err);
    res.status(500).json({ message: "Failed to get client report" });
  }
};
