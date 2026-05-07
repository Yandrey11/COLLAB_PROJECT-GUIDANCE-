import Record from "../models/Record.js";
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import Counselor from "../models/Counselor.js";
import GoogleUser from "../models/GoogleUser.js";
import { encryptToken, decryptToken } from "../utils/tokenEncryption.js";
import { createNotification } from "./admin/notificationController.js";
import { createCounselorNotification } from "./counselorNotificationController.js";
import { logLockAction } from "./admin/recordLockController.js";
import { generateCounselingRecordPDF } from "../utils/pdfUtils.js";
import { notArchivedFilter, isArchivedFilter, archivePurgeDateFromNow } from "../config/recordArchive.js";
import { getCatalogOptions } from "./admin/masterDataController.js";
import {
  generateCounselingSummaryPdf,
  buildSummaryMonthLabel,
  buildSummaryMonthLabelFromRecords,
  inferSummarySchoolYear,
} from "../utils/counselingSummaryPdf.js";
import { recordCounselorScopeFilter } from "../utils/userLookup.js";
import { sanitizeRecordForApi, sanitizeRecordsForApi } from "../utils/recordApiSanitize.js";

/** Fields for Individual Counseling Report PDF (decrypted document instance). */
function buildRecordPdfPayload(rec) {
  if (!rec) return null;
  return {
    _id: rec._id,
    clientName: rec.clientName || "N/A",
    date: rec.date,
    sessionType: rec.sessionType || "N/A",
    status: rec.status || "N/A",
    counselor: rec.counselor || "Unknown Counselor",
    sessionNumber: rec.sessionNumber,
    notes: rec.notes ?? null,
    outcomes: rec.outcomes ?? rec.outcome ?? null,
    schoolYear: rec.schoolYear,
    gender: rec.gender,
    course: rec.course,
    yearLevel: rec.yearLevel,
    section: rec.section,
    problemsPresented: rec.problemsPresented,
    problemsPresentedCodes: rec.problemsPresentedCodes,
    problemsPresentedNotes: rec.problemsPresentedNotes,
    remarks: rec.remarks,
    recommendation: rec.recommendation,
    recommendationAuthorName: rec.recommendationAuthorName,
    auditTrail: rec.auditTrail?.modificationHistory
      ? { modificationHistory: rec.auditTrail.modificationHistory }
      : undefined,
  };
}

// Build OAuth2 client for Google APIs (reusable for Drive, Calendar)
const getOAuth2Client = () =>
  new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/auth/google/callback"
  );

// Fallback Drive client using a system OAuth refresh token.
// This allows automatic uploads to a single configured Google account's Drive.
const getSystemOAuthDriveClient = async () => {
  try {
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    if (!refreshToken) {
      return null;
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_DRIVE_REDIRECT_URI || process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/auth/google/callback"
    );

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // Validate token grant early so invalid refresh tokens don't fail later during file upload.
    await oauth2Client.getAccessToken();

    return google.drive({ version: "v3", auth: oauth2Client });
  } catch (error) {
    console.error("❌ Failed to initialize system OAuth Drive client:", error.message);
    return null;
  }
};

// Fallback Drive client using service account credentials.
// This allows Drive uploads even when the current user has no Google OAuth tokens.
const getServiceAccountDriveClient = async () => {
  try {
    const serviceAccountPath = path.join(process.cwd(), "config", "google-service-account.json");
    if (!fs.existsSync(serviceAccountPath)) {
      return null;
    }

    const serviceAccountRaw = fs.readFileSync(serviceAccountPath, "utf8");
    const serviceAccount = JSON.parse(serviceAccountRaw);

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    return google.drive({ version: "v3", auth });
  } catch (error) {
    console.error("❌ Failed to initialize service account Drive client:", error.message);
    return null;
  }
};

// Get Drive client from user's Google tokens (auto-connected when user logs in with Google)
const getDriveClientFromUser = async (user) => {
  if (!user) return null;
  let accessToken = user.googleCalendarAccessToken;
  let refreshToken = user.googleCalendarRefreshToken;
  let tokenExpires = user.googleCalendarTokenExpires;

  if (!accessToken) {
    const uid = user._id || user.id;
    const email = user.email;
    const dbUser = await Counselor.findById(uid).select("googleCalendarAccessToken googleCalendarRefreshToken googleCalendarTokenExpires email");
    const googleUser = await GoogleUser.findById(uid).select("googleCalendarAccessToken googleCalendarRefreshToken googleCalendarTokenExpires email");
    let source = dbUser?.googleCalendarAccessToken ? dbUser : googleUser?.googleCalendarAccessToken ? googleUser : null;

    // Fallback by email to support accounts created locally then linked via Google.
    if (!source && email) {
      const byEmailCounselor = await Counselor.findOne({ email }).select("googleCalendarAccessToken googleCalendarRefreshToken googleCalendarTokenExpires email");
      const byEmailGoogleUser = await GoogleUser.findOne({ email }).select("googleCalendarAccessToken googleCalendarRefreshToken googleCalendarTokenExpires email");
      source = byEmailCounselor?.googleCalendarAccessToken
        ? byEmailCounselor
        : byEmailGoogleUser?.googleCalendarAccessToken
        ? byEmailGoogleUser
        : null;
    }

    if (source) {
      accessToken = decryptToken(source.googleCalendarAccessToken);
      refreshToken = decryptToken(source.googleCalendarRefreshToken);
      tokenExpires = source.googleCalendarTokenExpires;
    }
  }

  if (!accessToken) {
    const systemDrive = await getSystemOAuthDriveClient();
    if (systemDrive) {
      console.warn("⚠️ Using system OAuth Drive fallback (user not connected via Google OAuth)");
      return systemDrive;
    }

    const serviceDrive = await getServiceAccountDriveClient();
    if (serviceDrive) {
      console.warn("⚠️ Using service account Drive fallback (user not connected via Google OAuth)");
    }
    return serviceDrive;
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (tokenExpires && new Date() >= new Date(tokenExpires) && refreshToken) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
      const uid = user._id || user.id;
      const email = user.email;
      const dbUser = await Counselor.findById(uid);
      const googleUser = await GoogleUser.findById(uid);
      let toUpdate = dbUser || googleUser;

      if (!toUpdate && email) {
        toUpdate = (await Counselor.findOne({ email })) || (await GoogleUser.findOne({ email }));
      }

      if (toUpdate) {
        toUpdate.googleCalendarAccessToken = encryptToken(credentials.access_token);
        if (credentials.refresh_token) toUpdate.googleCalendarRefreshToken = encryptToken(credentials.refresh_token);
        toUpdate.googleCalendarTokenExpires = credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 3600 * 1000);
        await toUpdate.save();
      }
    } catch (err) {
      console.error("Token refresh failed:", err);
      const systemDrive = await getSystemOAuthDriveClient();
      if (systemDrive) {
        console.warn("⚠️ Token refresh failed. Falling back to system OAuth Drive client");
        return systemDrive;
      }

      const serviceDrive = await getServiceAccountDriveClient();
      if (serviceDrive) {
        console.warn("⚠️ Token refresh failed. Falling back to service account Drive client");
      }
      return serviceDrive;
    }
  }

  return google.drive({ version: "v3", auth: oauth2Client });
};

// Get or create "Counseling Records" folder in user's Drive (used when configured folder is missing)
const getOrCreateCounselingFolder = async (drive) => {
  const folderName = "Counseling Records";
  try {
    const listRes = await drive.files.list({
      q: `name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`,
      fields: "files(id, name)",
      spaces: "drive",
    });
    const existing = listRes.data.files?.[0];
    if (existing) return existing.id;

    const createRes = await drive.files.create({
      resource: {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });
    console.log(`✅ Created "${folderName}" folder in user's Drive`);
    return createRes.data.id;
  } catch (err) {
    console.error("Failed to get/create Counseling Records folder:", err);
    return null;
  }
};

const isDriveAuthError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  const description = String(error?.response?.data?.error_description || "").toLowerCase();
  const status = error?.status || error?.code || error?.response?.status;

  return (
    status === 401 ||
    message.includes("invalid_grant") ||
    description.includes("invalid grant") ||
    message.includes("account not found") ||
    description.includes("account not found")
  );
};

// Upload with robust retry behavior using a fresh file stream on each attempt.
// Reusing a consumed stream can cause ERR_STREAM_PUSH_AFTER_EOF.
const uploadPdfToDriveWithFolderFallback = async ({ drive, fileName, pdfPath, folderId }) => {
  const createDriveFile = async (parentFolderId = null) => {
    const resource = parentFolderId
      ? { name: fileName, parents: [parentFolderId] }
      : { name: fileName };

    return drive.files.create({
      resource,
      media: {
        mimeType: "application/pdf",
        body: fs.createReadStream(pdfPath),
      },
      fields: "id, webViewLink",
    });
  };

  try {
    return await createDriveFile(folderId || null);
  } catch (folderErr) {
    if (isDriveAuthError(folderErr)) {
      throw folderErr;
    }

    const folderIssue = Boolean(folderId) && (
      folderErr.code === 404 ||
      folderErr.code === 403 ||
      String(folderErr.message || "").toLowerCase().includes("not found")
    );

    if (!folderIssue) {
      throw folderErr;
    }

    console.warn("⚠️ Drive folder not accessible, creating Counseling Records folder in user's Drive");
    const userFolderId = await getOrCreateCounselingFolder(drive);

    if (userFolderId) {
      try {
        return await createDriveFile(userFolderId);
      } catch (retryErr) {
        if (isDriveAuthError(retryErr)) {
          throw retryErr;
        }
      }
    }

    // Final fallback: upload to root without a parent folder.
    return createDriveFile(null);
  }
};

// Get Calendar client from user's Google tokens (for syncing records to Google Calendar)
const getCalendarClientFromUser = async (user) => {
  if (!user) return null;
  let accessToken = user.googleCalendarAccessToken;
  let refreshToken = user.googleCalendarRefreshToken;
  let tokenExpires = user.googleCalendarTokenExpires;

  if (!accessToken) {
    const uid = user._id || user.id;
    const email = user.email;
    const dbUser = await Counselor.findById(uid).select("googleCalendarAccessToken googleCalendarRefreshToken googleCalendarTokenExpires email");
    const googleUser = await GoogleUser.findById(uid).select("googleCalendarAccessToken googleCalendarRefreshToken googleCalendarTokenExpires email");
    let source = dbUser?.googleCalendarAccessToken ? dbUser : googleUser?.googleCalendarAccessToken ? googleUser : null;

    // Fallback by email to support accounts created locally then linked via Google.
    if (!source && email) {
      const byEmailCounselor = await Counselor.findOne({ email }).select("googleCalendarAccessToken googleCalendarRefreshToken googleCalendarTokenExpires email");
      const byEmailGoogleUser = await GoogleUser.findOne({ email }).select("googleCalendarAccessToken googleCalendarRefreshToken googleCalendarTokenExpires email");
      source = byEmailCounselor?.googleCalendarAccessToken
        ? byEmailCounselor
        : byEmailGoogleUser?.googleCalendarAccessToken
        ? byEmailGoogleUser
        : null;
    }

    if (source) {
      accessToken = decryptToken(source.googleCalendarAccessToken);
      refreshToken = decryptToken(source.googleCalendarRefreshToken);
      tokenExpires = source.googleCalendarTokenExpires;
    }
  }

  if (!accessToken) return null;

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (tokenExpires && new Date() >= new Date(tokenExpires) && refreshToken) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
      const uid = user._id || user.id;
      const email = user.email;
      const dbUser = await Counselor.findById(uid);
      const googleUser = await GoogleUser.findById(uid);
      let toUpdate = dbUser || googleUser;

      if (!toUpdate && email) {
        toUpdate = (await Counselor.findOne({ email })) || (await GoogleUser.findOne({ email }));
      }

      if (toUpdate) {
        toUpdate.googleCalendarAccessToken = encryptToken(credentials.access_token);
        if (credentials.refresh_token) toUpdate.googleCalendarRefreshToken = encryptToken(credentials.refresh_token);
        toUpdate.googleCalendarTokenExpires = credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 3600 * 1000);
        await toUpdate.save();
      }
    } catch (err) {
      console.error("Token refresh failed:", err);
      return null;
    }
  }

  return google.calendar({ version: "v3", auth: oauth2Client });
};

// Sync record to Google Calendar (create or update event so it appears in user's Google Calendar)
const syncRecordToGoogleCalendar = async (record, req) => {
  try {
    const calendar = await getCalendarClientFromUser(req.user);
    if (!calendar) {
      console.warn("⚠️ Google Calendar not connected — skipping sync (sign in with Google to enable)");
      return null;
    }

    const recordDate = new Date(record.date);
    const startDate = new Date(recordDate);
    // Use record time if it has meaningful time (not midnight); otherwise default 9 AM
    const hours = startDate.getHours();
    const mins = startDate.getMinutes();
    if (hours === 0 && mins === 0) {
      startDate.setHours(9, 0, 0, 0);
    }
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1, endDate.getMinutes(), 0, 0);

    const eventTitle = `${record.clientName} - ${record.sessionType || "Session"} (${record.status || "Ongoing"})`;
    const eventDescription = `Counseling Session #${record.sessionNumber || 1}\nClient: ${record.clientName}\nCounselor: ${record.counselor}\nStatus: ${record.status || "Ongoing"}`;

    const eventResource = {
      summary: eventTitle,
      description: eventDescription,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: "UTC",
      },
    };

    if (record.googleCalendarEventId) {
      try {
        await calendar.events.update({
          calendarId: "primary",
          eventId: record.googleCalendarEventId,
          requestBody: eventResource,
        });
        console.log(`✅ Updated Google Calendar event for record ${record._id}`);
        return record.googleCalendarEventId;
      } catch (updateErr) {
        if (updateErr.code === 404) {
          record.googleCalendarEventId = undefined;
        } else throw updateErr;
      }
    }

    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: eventResource,
    });

    const eventId = res.data.id;
    record.googleCalendarEventId = eventId;
    await record.save();
    console.log(`✅ Created Google Calendar event for record ${record._id} (${record.clientName})`);
    return eventId;
  } catch (err) {
    console.error("❌ Google Calendar sync error:", err);
    return null;
  }
};

// Helper to get user info from request
const getUserInfo = (req) => {
  return {
    userId: req.user?._id || req.admin?._id,
    userName: req.user?.name || req.user?.email || req.admin?.name || req.admin?.email || "Unknown User",
    userRole: req.user?.role || req.admin?.role || "counselor",
    userEmail: req.user?.email || req.admin?.email || "unknown@example.com",
  };
};

const isAdminRequest = (req) => req.user?.role === "admin" || req.admin?.role === "admin";

// 📋 1️⃣ Fetch all records (with query filters)
export const getRecords = async (req, res) => {
  try {
    const { search, sessionType, status, startDate, endDate, sortBy, order, archived } = req.query;

    const clauses = [archived === "true" ? isArchivedFilter() : notArchivedFilter()];
    const scope = recordCounselorScopeFilter(req);
    if (scope) clauses.push(scope);

    if (sessionType) clauses.push({ sessionType });
    if (status) clauses.push({ status });
    if (startDate && endDate) {
      clauses.push({ date: { $gte: new Date(startDate), $lte: new Date(endDate) } });
    }

    const filter = clauses.length === 1 ? clauses[0] : { $and: clauses };

    const sortOption = {};
    if (sortBy) sortOption[sortBy] = order === "desc" ? -1 : 1;

    let records = await Record.find(filter).sort(sortOption).lean();
    records = sanitizeRecordsForApi(records);

    // clientName is encrypted at rest — substring match after decrypt.
    if (search && typeof search === "string" && search.trim()) {
      const n = search.trim().toLowerCase();
      records = records.filter((r) => (r.clientName || "").toLowerCase().includes(n));
    }

    res.json(records);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch records", error: err.message });
  }
};

export const getShareTargets = async (req, res) => {
  try {
    const userInfo = getUserInfo(req);
    const record = await Record.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }

    if (!recordOwnedByRequestUser(record, req, userInfo) && !isAdminRequest(req)) {
      return res.status(403).json({ message: "You don't have permission to manage sharing for this record." });
    }

    const sharedIds = Array.isArray(record.sharedWith)
      ? record.sharedWith.map((id) => String(id))
      : [];

    const [counselors, googleCounselors, sharedCounselors, sharedGoogleCounselors] = await Promise.all([
      Counselor.find({ role: { $ne: "admin" } })
        .select("_id name email")
        .lean(),
      GoogleUser.find({ role: { $ne: "admin" } })
        .select("_id name email role")
        .lean(),
      Counselor.find({ _id: { $in: sharedIds } }).select("_id name email").lean(),
      GoogleUser.find({ _id: { $in: sharedIds } }).select("_id name email role").lean(),
    ]);

    const currentUserId = String(req.user?._id || req.user?.id || req.admin?._id || "");
    const allCandidates = [
      ...counselors.map((u) => ({ id: String(u._id), name: u.name || u.email, email: u.email || "" })),
      ...googleCounselors
        .filter((u) => (u.role || "counselor") !== "admin")
        .map((u) => ({ id: String(u._id), name: u.name || u.email, email: u.email || "" })),
    ];

    const seen = new Set();
    const targets = [];
    for (const c of allCandidates) {
      if (!c.id || seen.has(c.id) || c.id === currentUserId) continue;
      seen.add(c.id);
      if (!sharedIds.includes(c.id)) {
        targets.push(c);
      }
    }

    const shared = [...sharedCounselors, ...sharedGoogleCounselors].map((u) => ({
      id: String(u._id),
      name: u.name || u.email,
      email: u.email || "",
    }));

    return res.json({ success: true, targets, shared });
  } catch (err) {
    console.error("❌ Get share targets error:", err);
    return res.status(500).json({ message: "Failed to load sharing targets", error: err.message });
  }
};

export const shareRecordWithCounselor = async (req, res) => {
  try {
    const { counselorId } = req.body || {};
    if (!counselorId) {
      return res.status(400).json({ message: "counselorId is required" });
    }

    const userInfo = getUserInfo(req);
    const record = await Record.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }

    if (!recordOwnedByRequestUser(record, req, userInfo) && !isAdminRequest(req)) {
      return res.status(403).json({ message: "You don't have permission to share this record." });
    }

    const targetCounselor =
      (await Counselor.findById(counselorId).select("_id name email role").lean()) ||
      (await GoogleUser.findById(counselorId).select("_id name email role").lean());
    if (!targetCounselor || (targetCounselor.role || "counselor") === "admin") {
      return res.status(404).json({ message: "Counselor target not found" });
    }

    const targetId = String(targetCounselor._id);
    if (String(req.user?._id || req.user?.id || "") === targetId) {
      return res.status(400).json({ message: "You cannot share a record with yourself." });
    }

    if (!Array.isArray(record.sharedWith)) {
      record.sharedWith = [];
    }

    if (!record.sharedWith.some((id) => String(id) === targetId)) {
      record.sharedWith.push(targetCounselor._id);
      record.sharedHistory = Array.isArray(record.sharedHistory) ? record.sharedHistory : [];
      record.sharedHistory.push({
        counselorId: targetCounselor._id,
        counselorName: targetCounselor.name || targetCounselor.email,
        action: "shared",
        sharedBy: {
          userId: userInfo.userId,
          userName: userInfo.userName,
          userRole: userInfo.userRole,
        },
        timestamp: new Date(),
      });
      await record.save();
    }

    return res.json({
      success: true,
      message: "Record shared successfully.",
      record: sanitizeRecordForApi(record),
    });
  } catch (err) {
    console.error("❌ Share record error:", err);
    return res.status(500).json({ message: "Failed to share record", error: err.message });
  }
};

export const unshareRecordWithCounselor = async (req, res) => {
  try {
    const { counselorId } = req.body || {};
    if (!counselorId) {
      return res.status(400).json({ message: "counselorId is required" });
    }

    const userInfo = getUserInfo(req);
    const record = await Record.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }

    if (!recordOwnedByRequestUser(record, req, userInfo) && !isAdminRequest(req)) {
      return res.status(403).json({ message: "You don't have permission to unshare this record." });
    }

    const before = Array.isArray(record.sharedWith) ? record.sharedWith : [];
    record.sharedWith = before.filter((id) => String(id) !== String(counselorId));

    if (before.length !== record.sharedWith.length) {
      record.sharedHistory = Array.isArray(record.sharedHistory) ? record.sharedHistory : [];
      record.sharedHistory.push({
        counselorId,
        action: "unshared",
        sharedBy: {
          userId: userInfo.userId,
          userName: userInfo.userName,
          userRole: userInfo.userRole,
        },
        timestamp: new Date(),
      });
      await record.save();
    }

    return res.json({
      success: true,
      message: "Record unshared successfully.",
      record: sanitizeRecordForApi(record),
    });
  } catch (err) {
    console.error("❌ Unshare record error:", err);
    return res.status(500).json({ message: "Failed to unshare record", error: err.message });
  }
};

/** Colleges / courses / year levels for record forms (counselor-facing). */
export const getRecordCatalogOptions = async (req, res) => {
  try {
    const options = await getCatalogOptions();
    res.json({ success: true, ...options });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch catalog options",
      error: err.message,
    });
  }
};

/** Remove counselor-archived records past retention (`archivePurgeAt`). Called from app scheduler. */
export async function purgeExpiredArchivedRecords() {
  const now = new Date();
  const result = await Record.deleteMany({
    archivedAt: { $ne: null },
    archivePurgeAt: { $lte: now },
  });
  if (result.deletedCount > 0) {
    console.log(`[archive-purge] deleted ${result.deletedCount} expired archived record(s)`);
  }
  return result;
}

// ☁️ Sync records without Drive link to the logged-in user's Google Drive (uses account used to login)
export const syncRecordsToDrive = async (req, res) => {
  try {
    const scope = recordCounselorScopeFilter(req);
    const driveEmpty = {
      $or: [{ driveLink: { $exists: false } }, { driveLink: null }, { driveLink: "" }],
    };
    const filter = scope ? { $and: [scope, driveEmpty] } : driveEmpty;
    const recordsToSync = await Record.find(filter);
    let synced = 0;
    let skipped = 0;
    for (const record of recordsToSync) {
      const link = await uploadRecordToDrive(record, req);
      if (link) synced++;
      else skipped++;
    }
    res.json({
      success: true,
      message: `Uploaded ${synced} records to your Google Drive. ${skipped} skipped (no Google connection).`,
      synced,
      skipped,
    });
  } catch (err) {
    console.error("Sync to Drive error:", err);
    res.status(500).json({ message: "Failed to sync records to Google Drive", error: err.message });
  }
};

// 📅 Sync all records to Google Calendar (for existing records created before sync was enabled)
export const syncAllRecordsToGoogleCalendar = async (req, res) => {
  try {
    const scope = recordCounselorScopeFilter(req);
    const records = scope ? await Record.find(scope) : await Record.find({});
    let synced = 0;
    let skipped = 0;
    for (const record of records) {
      const result = await syncRecordToGoogleCalendar(record, req);
      if (result) synced++;
      else skipped++;
    }
    res.json({
      success: true,
      message: `Synced ${synced} of your records to Google Calendar. ${skipped} skipped.`,
      synced,
      skipped,
    });
  } catch (err) {
    console.error("Sync all to Google Calendar error:", err);
    res.status(500).json({ message: "Failed to sync records to Google Calendar", error: err.message });
  }
};

// ✏️ 2️⃣ Update a record (STRICT 2PL: Lock ownership validated by middleware)
export const updateRecord = async (req, res) => {
  try {
    const userInfo = getUserInfo(req);
    const record = await Record.findById(req.params.id);
    
    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }
    if (!assertRecordAccess(record, req, userInfo)) {
      return res.status(403).json({ message: "You don't have permission to update this record." });
    }

    // STRICT 2PL: Additional lock ownership validation (defense in depth)
    const RecordLock = (await import("../models/RecordLock.js")).default;
    const { cleanupExpiredLocks } = await import("./admin/recordLockController.js");
    await cleanupExpiredLocks();

    const now = new Date();
    const lock = await RecordLock.findOne({
      recordId: req.params.id,
      isActive: true,
      expiresAt: { $gte: now },
    });

    if (lock) {
      const isLockOwner = lock.lockedBy.userId.toString() === userInfo.userId.toString();
      if (!isLockOwner) {
        return res.status(423).json({
          success: false,
          message: `Record is locked by ${lock.lockedBy.userName}. Only the lock owner can update.`,
          lockedBy: {
            userId: lock.lockedBy.userId,
            userName: lock.lockedBy.userName,
            userRole: lock.lockedBy.userRole,
          },
        });
      }
      // Lock ownership validated - lock persists (growing phase of 2PL)
    } else {
      // STRICT 2PL: Record must be locked before editing
      return res.status(423).json({
        success: false,
        message: "Record must be locked before editing. Please lock the record first.",
      });
    }

    // Track changes for audit trail
    const changes = [];
    const updateData = { ...req.body };

    // Compare old and new values
    Object.keys(updateData).forEach((key) => {
      if (key !== "auditTrail" && key !== "attachments" && record[key] !== updateData[key]) {
        changes.push({
          field: key,
          oldValue: record[key],
          newValue: updateData[key],
          changedBy: userInfo,
          changedAt: new Date(),
        });
      }
    });

    // Update record
    Object.assign(record, updateData);

    // Update audit trail
    if (!record.auditTrail) {
      record.auditTrail = {
        createdBy: userInfo,
        createdAt: record.createdAt || new Date(),
        lastModifiedBy: userInfo,
        lastModifiedAt: new Date(),
        modificationHistory: [],
      };
    } else {
      record.auditTrail.lastModifiedBy = userInfo;
      record.auditTrail.lastModifiedAt = new Date();
    }
    
    if (changes.length > 0) {
      if (!record.auditTrail.modificationHistory) {
        record.auditTrail.modificationHistory = [];
      }
      record.auditTrail.modificationHistory.push(...changes);
    }

    await record.save();

    // Sync to Google Calendar if date/clientName/sessionType/status changed
    const calendarRelevantFields = ["date", "clientName", "sessionType", "status"];
    if (changes.some((c) => calendarRelevantFields.includes(c.field))) {
      await syncRecordToGoogleCalendar(record, req);
    }

    // Log UPDATE action
    try {
      const RecordLock = (await import("../models/RecordLock.js")).default;
      const currentLock = await RecordLock.findOne({
        recordId: req.params.id,
        isActive: true,
        expiresAt: { $gte: new Date() },
      });
      
      await logLockAction(
        req.params.id,
        "UPDATE",
        userInfo,
        currentLock?.lockedBy || null,
        `Record updated by ${userInfo.userName} (${userInfo.userRole})`,
        {
          changedFields: changes.map((c) => c.field),
          changeCount: changes.length,
          clientName: record.clientName,
          sessionNumber: record.sessionNumber,
        }
      );
    } catch (logError) {
      console.error("⚠️ Failed to log UPDATE action (non-critical):", logError);
    }

    // ✅ Create notification for admins
    try {
      await createNotification({
        title: "Record Updated",
        description: `${userInfo.userName} (${userInfo.userRole}) updated record for client: ${record.clientName} - Session ${record.sessionNumber}`,
        category: "User Activity",
        priority: "medium",
        metadata: {
          clientName: record.clientName,
          recordId: record._id.toString(),
          updatedBy: userInfo.userName,
          updatedByRole: userInfo.userRole,
          changes: changes.map((c) => c.field),
        },
        relatedId: record._id,
        relatedType: "record",
      });
    } catch (notificationError) {
      console.error("⚠️ Admin notification creation failed (non-critical):", notificationError);
    }

    // ✅ Create notification for the counselor who updated the record
    try {
      if (req.user?._id || req.user?.id) {
        await createCounselorNotification({
          counselorId: req.user._id || req.user.id,
          counselorEmail: req.user.email,
          title: "Record Updated Successfully",
          description: `Your record for ${record.clientName} (Session ${record.sessionNumber}) has been updated.`,
          category: "Updated Record",
          priority: "medium",
          metadata: {
            clientName: record.clientName,
            recordId: record._id.toString(),
            sessionNumber: record.sessionNumber,
            updatedFields: changes.map((c) => c.field),
          },
          relatedId: record._id,
          relatedType: "record",
        });
      }
    } catch (notificationError) {
      console.error("⚠️ Counselor notification creation failed (non-critical):", notificationError);
    }

    res.json(sanitizeRecordForApi(record));
  } catch (err) {
    res.status(500).json({ message: "Failed to update record", error: err.message });
  }
};

// Helper function to upload record to drive
const uploadRecordToDrive = async (record, req) => {
  try {
    const drive = await getDriveClientFromUser(req.user);
    if (!drive) {
      console.warn("⚠️ Google Drive not connected — skipping auto-upload (sign in with Google to enable)");
      return null;
    }

    // ✅ Fetch record from database to ensure all fields are populated
    let recordData;
    if (record._id) {
      const fetchedRecord = await Record.findById(record._id);
      if (!fetchedRecord) {
        console.error("❌ Record not found in database");
        return null;
      }
      // Convert to plain object to ensure all fields are accessible
      recordData = buildRecordPdfPayload(fetchedRecord);
    } else {
      // If record is already a plain object, use it directly
      recordData = buildRecordPdfPayload(record);
    }

    // Get counselor name for filename
    const counselorName = recordData.counselor || req.user?.name || req.user?.email || "Unknown_Counselor";
    const sanitizedCounselorName = counselorName.replace(/[^a-zA-Z0-9]/g, '_');

     const pdfPath = await generateCounselingRecordPDF(recordData, sanitizedCounselorName);
     const fileName = path.basename(pdfPath);

    // ✅ Upload PDF to Google Drive (to logged-in user's account)
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const file = await uploadPdfToDriveWithFolderFallback({ drive, fileName, pdfPath, folderId });

    const driveLink = file.data.webViewLink;

    // ✅ Update record in DB
    record.driveLink = driveLink;
    await record.save();

    // ✅ Create notification for admin about PDF generation
    try {
      const userRole = req.user?.role || "counselor";
      const userName = req.user?.name || req.user?.email || record.counselor || "Unknown User";
      
      await createNotification({
        title: "PDF Generated and Uploaded",
        description: `${userName} (${userRole}) has generated and uploaded a PDF for client: ${recordData.clientName} - Session ${recordData.sessionNumber}. File: ${fileName}`,
        category: "User Activity",
        priority: "low",
        metadata: {
          clientName: recordData.clientName,
          recordId: recordData._id.toString(),
          pdfFileName: fileName,
          driveLink: driveLink,
          generatedBy: userName,
          generatedByRole: userRole,
        },
        relatedId: recordData._id.toString(),
        relatedType: "record",
      });
    } catch (notificationError) {
      console.error("⚠️ Admin notification creation failed (non-critical):", notificationError);
    }

    // ✅ Create notification for counselor about successful Drive upload
    try {
      if (req.user?._id || req.user?.id) {
        await createCounselorNotification({
          counselorId: req.user._id || req.user.id,
          counselorEmail: req.user.email,
          title: "Record Uploaded to Google Drive",
          description: `Your record for ${recordData.clientName} (Session ${recordData.sessionNumber}) has been successfully uploaded to Google Drive.`,
          category: "New Record",
          priority: "low",
          metadata: {
            clientName: recordData.clientName,
            recordId: recordData._id.toString(),
            sessionNumber: recordData.sessionNumber,
            driveLink: driveLink,
            fileName: fileName,
          },
          relatedId: recordData._id,
          relatedType: "record",
        });
      }
    } catch (notificationError) {
      console.error("⚠️ Counselor notification creation failed (non-critical):", notificationError);
    }

    // ✅ Clean up local PDF
    fs.unlinkSync(pdfPath);

    return driveLink;
  } catch (err) {
    console.error("❌ Drive upload error:", err);
    return null;
  }
};

// ➕ 3️⃣ Create a new counseling record
export const createRecord = async (req, res) => {
  try {
    const userInfo = getUserInfo(req);
    
    // Get counselor name - prioritize from authenticated user, then from request body, then fallback
    let counselorName = userInfo.userName;
    
    // If userName is "Unknown User", try to get from request body
    if (counselorName === "Unknown User" && req.body.counselor) {
      counselorName = req.body.counselor;
    }
    
    // If still unknown, try to get from req.user or req.admin directly
    if (counselorName === "Unknown User") {
      if (req.user?.name) {
        counselorName = req.user.name;
      } else if (req.user?.email) {
        counselorName = req.user.email;
      } else if (req.admin?.name) {
        counselorName = req.admin.name;
      } else if (req.admin?.email) {
        counselorName = req.admin.email;
      }
    }
    
    // Calculate session number for this client
    const existingRecordsCount = await Record.countDocuments({ 
      clientName: req.body.clientName 
    });
    const sessionNumber = existingRecordsCount + 1;
    
    const record = new Record({
      clientName: req.body.clientName,
      date: req.body.date,
      sessionType: req.body.sessionType,
      sessionNumber: sessionNumber,
      status: req.body.status,
      notes: req.body.notes,
      outcomes: req.body.outcomes,
      driveLink: req.body.driveLink,
      counselor: counselorName, // ✅ Set automatically from authenticated user
      auditTrail: {
        createdBy: userInfo,
        createdAt: new Date(),
        lastModifiedBy: userInfo,
        lastModifiedAt: new Date(),
        modificationHistory: [],
      },
    });

    await record.save();
    
    // ✅ Create notification for admins
    try {
      await createNotification({
        title: "New Record Created",
        description: `${userInfo.userName} (${userInfo.userRole}) created a new record for client: ${record.clientName} - Session ${record.sessionNumber}`,
        category: "User Activity",
        priority: "medium",
        metadata: {
          clientName: record.clientName,
          recordId: record._id.toString(),
          createdBy: userInfo.userName,
          createdByRole: userInfo.userRole,
          sessionNumber: record.sessionNumber,
        },
        relatedId: record._id,
        relatedType: "record",
      });
    } catch (notificationError) {
      console.error("⚠️ Admin notification creation failed (non-critical):", notificationError);
    }

    // ✅ Create notification for the counselor who created the record
    try {
      if (req.user?._id || req.user?.id) {
        await createCounselorNotification({
          counselorId: req.user._id || req.user.id,
          counselorEmail: req.user.email,
          title: "Record Created Successfully",
          description: `Your record for ${record.clientName} (Session ${record.sessionNumber}) has been created and uploaded to Google Drive.`,
          category: "New Record",
          priority: "medium",
          metadata: {
            clientName: record.clientName,
            recordId: record._id.toString(),
            sessionNumber: record.sessionNumber,
            driveLink: record.driveLink || null,
          },
          relatedId: record._id,
          relatedType: "record",
        });
      }
    } catch (notificationError) {
      console.error("⚠️ Counselor notification creation failed (non-critical):", notificationError);
    }
    
    // ✅ Automatically upload to drive after saving
    const driveLink = await uploadRecordToDrive(record, req);
    // ✅ Sync to Google Calendar so it appears in user's Google Calendar
    await syncRecordToGoogleCalendar(record, req);
    if (driveLink) {
      console.log("✅ Record automatically uploaded to Google Drive");
      
      // ✅ Update counselor notification with drive link (if notification was created)
      try {
        if (req.user?._id || req.user?.id) {
          // Find the most recent notification for this counselor about this record
          const CounselorNotification = (await import("../models/CounselorNotification.js")).default;
          const notification = await CounselorNotification.findOne({
            counselorId: req.user._id || req.user.id,
            relatedId: record._id,
            relatedType: "record",
            category: "New Record",
          }).sort({ createdAt: -1 });

          if (notification) {
            notification.metadata.driveLink = driveLink;
            await notification.save();
          }
        }
      } catch (updateError) {
        console.error("⚠️ Failed to update notification with drive link (non-critical):", updateError);
      }
    }

    res.status(201).json(sanitizeRecordForApi(record));
  } catch (err) {
    console.error("Error creating record:", err);
    res.status(500).json({ message: "Failed to create record", error: err.message });
  }
};


// ☁️ 4️⃣ Upload to Google Drive (PDF)

// ☁️ Upload counseling session PDF to Google Drive


export const uploadToDrive = async (req, res) => {
  try {
    const userInfo = getUserInfo(req);
    const record = await Record.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: "Record not found" });
    }
    if (!assertRecordAccess(record, req, userInfo)) {
      return res.status(403).json({ error: "You don't have permission to access this record." });
    }

    const drive = await getDriveClientFromUser(req.user);
    if (!drive) {
      return res.status(401).json({ error: "Google Drive not connected. Sign in with Google to enable Drive uploads." });
    }

    // Convert to plain object to ensure all fields are accessible
    const recordData = buildRecordPdfPayload(record);

    // Get counselor name for filename
    const counselorName = recordData.counselor || req.user?.name || req.user?.email || "Unknown_Counselor";
    const sanitizedCounselorName = counselorName.replace(/[^a-zA-Z0-9]/g, '_');

     const pdfPath = await generateCounselingRecordPDF(recordData, sanitizedCounselorName);
     const fileName = path.basename(pdfPath);

    // ✅ Upload PDF to Google Drive (to logged-in user's account)
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const file = await uploadPdfToDriveWithFolderFallback({ drive, fileName, pdfPath, folderId });

    const driveLink = file.data.webViewLink;

    // ✅ Update record in DB
    record.driveLink = driveLink;
    await record.save();

    // ✅ Create notification for admin about PDF generation
    try {
      const userRole = req.user?.role || "counselor";
      const userName = req.user?.name || req.user?.email || record.counselor || "Unknown User";
      
      await createNotification({
        title: "PDF Generated and Uploaded",
        description: `${userName} (${userRole}) has generated and uploaded a PDF for client: ${recordData.clientName}. File: ${fileName}`,
        category: "User Activity",
        priority: "low",
        metadata: {
          clientName: recordData.clientName,
          recordId: recordData._id.toString(),
          pdfFileName: fileName,
          driveLink: driveLink,
          generatedBy: userName,
          generatedByRole: userRole,
        },
        relatedId: recordData._id.toString(),
        relatedType: "record",
      });
    } catch (notificationError) {
      console.error("⚠️ Notification creation failed (non-critical):", notificationError);
    }

    // ✅ Clean up local PDF
    fs.unlinkSync(pdfPath);

    res.json({
      success: true,
      message: "Uploaded to Google Drive successfully",
      driveLink,
    });
  } catch (err) {
    console.error("❌ Drive upload error:", err);
    res.status(500).json({ error: err.message });
  }
};

// 📄 Generate PDF for a single record (download only, no Drive upload)
export const generateRecordPDF = async (req, res) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({ error: "Record ID is required" });
    }

    const userInfo = getUserInfo(req);
    const record = await Record.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: "Record not found" });
    }
    if (!assertRecordAccess(record, req, userInfo)) {
      return res.status(403).json({ error: "You don't have permission to access this record." });
    }

    const recordData = buildRecordPdfPayload(record);

    if (!recordData.clientName || recordData.clientName === "N/A") {
      return res.status(400).json({ error: "Record is missing required information" });
    }

    const counselorName = recordData.counselor || req.user?.name || req.user?.email || req.admin?.name || req.admin?.email || "Unknown_Counselor";
    const sanitizedCounselorName = counselorName.replace(/[^a-zA-Z0-9]/g, "_");

    const pdfPath = await generateCounselingRecordPDF(recordData, sanitizedCounselorName);
    const fileName = `individual-counseling-report-${req.params.id}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    return res.sendFile(path.resolve(pdfPath), (sendErr) => {
      try {
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
        }
      } catch (cleanupErr) {
        console.error("Failed to clean up temporary PDF:", cleanupErr);
      }

      if (sendErr && !res.headersSent) {
        res.status(500).json({ error: "Failed to stream generated PDF." });
      }
    });
  } catch (err) {
    console.error("❌ PDF generation error:", err);
    if (!res.headersSent) {
      return res.status(500).json({
        error: err.message || "Failed to generate PDF. Please try again.",
      });
    }
  }
};

/** Multi-record counseling summary table PDF (POST body: recordIds, optional startDate/endDate). */
export const generateSummaryRecordsPDF = async (req, res) => {
  try {
    const { recordIds, startDate, endDate } = req.body || {};
    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      return res.status(400).json({ error: "recordIds array is required" });
    }

    const userInfo = getUserInfo(req);
    const counselorName = userInfo.userName;
    const counselorEmail = userInfo.userEmail;

    let records = sanitizeRecordsForApi(
      await Record.find({ _id: { $in: recordIds } }).lean()
    );

    records = records.filter((r) => {
      const isOwner =
        r.counselor === counselorName ||
        r.counselor === counselorEmail ||
        (req.user?.email && r.counselor === req.user.email) ||
        (req.user?.name && r.counselor === req.user.name);
      return isOwner || req.user?.role === "admin";
    });

    if (startDate && endDate) {
      const a = new Date(startDate);
      const b = new Date(endDate);
      if (!Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime())) {
        records = records.filter((r) => {
          if (!r.date) return false;
          const d = new Date(r.date);
          return d >= a && d <= b;
        });
      }
    }

    records.sort((x, y) => {
      const dx = x.date ? new Date(x.date).getTime() : 0;
      const dy = y.date ? new Date(y.date).getTime() : 0;
      return dx - dy;
    });

    if (!records.length) {
      return res.status(404).json({ error: "No matching records found for export." });
    }

    const monthLabel =
      startDate || endDate
        ? buildSummaryMonthLabel(startDate || null, endDate || null)
        : buildSummaryMonthLabelFromRecords(records);
    const schoolYear = inferSummarySchoolYear(records);
    const trackingNumber = `DOC-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const reportDate = new Date().toLocaleDateString();

    const pdfPath = await generateCounselingSummaryPdf(records, {
      monthLabel,
      schoolYear,
      trackingNumber,
      reportDate,
      generatedByName: userInfo.userName,
    });

    const fileName = `counseling_summary_${trackingNumber}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    return res.sendFile(path.resolve(pdfPath), (sendErr) => {
      try {
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
        }
      } catch (cleanupErr) {
        console.error("Failed to clean up temporary PDF:", cleanupErr);
      }

      if (sendErr && !res.headersSent) {
        res.status(500).json({ error: "Failed to stream generated PDF." });
      }
    });
  } catch (err) {
    console.error("❌ Summary PDF error:", err);
    if (!res.headersSent) {
      return res.status(500).json({
        error: err.message || "Failed to generate summary PDF.",
      });
    }
  }
};

const recordOwnedByRequestUser = (record, req, userInfo) => {
  const counselorName = userInfo.userName;
  const counselorEmail = userInfo.userEmail;
  return (
    record.counselor === counselorName ||
    record.counselor === counselorEmail ||
    (req.user?.email && record.counselor === req.user.email) ||
    (req.user?.name && record.counselor === req.user.name)
  );
};

const assertRecordAccess = (record, req, userInfo) => {
  if (req.user?.role === "admin" || req.admin?.role === "admin") return true;
  return recordOwnedByRequestUser(record, req, userInfo);
};

export const archiveRecord = async (req, res) => {
  try {
    const userInfo = getUserInfo(req);
    const record = await Record.findById(req.params.id);

    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }

    if (!recordOwnedByRequestUser(record, req, userInfo) && req.user?.role !== "admin") {
      return res.status(403).json({ message: "You don't have permission to archive this record." });
    }

    if (record.archivedAt) {
      return res.status(400).json({ message: "Record is already archived." });
    }

    record.archivedAt = new Date();
    record.archivePurgeAt = archivePurgeDateFromNow();
    record.archivedBy = {
      userId: userInfo.userId,
      userName: userInfo.userName,
      userRole: userInfo.userRole,
    };
    await record.save();

    res.json({ success: true, message: "Record archived.", record: sanitizeRecordForApi(record) });
  } catch (err) {
    console.error("❌ Archive record error:", err);
    res.status(500).json({ message: "Failed to archive record", error: err.message });
  }
};

export const unarchiveRecord = async (req, res) => {
  try {
    const userInfo = getUserInfo(req);
    const record = await Record.findById(req.params.id);

    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }

    if (!recordOwnedByRequestUser(record, req, userInfo) && req.user?.role !== "admin") {
      return res.status(403).json({ message: "You don't have permission to unarchive this record." });
    }

    if (!record.archivedAt) {
      return res.status(400).json({ message: "Record is not archived." });
    }

    record.archivedAt = null;
    record.archivePurgeAt = null;
    record.archivedBy = undefined;
    await record.save();

    res.json({ success: true, message: "Record restored from archive.", record: sanitizeRecordForApi(record) });
  } catch (err) {
    console.error("❌ Unarchive record error:", err);
    res.status(500).json({ message: "Failed to unarchive record", error: err.message });
  }
};

// 🗑️ Delete a record (for counselors)
export const deleteRecord = async (req, res) => {
  try {
    const userInfo = getUserInfo(req);
    const record = await Record.findById(req.params.id);

    if (!record) {
      return res.status(404).json({ message: "Record not found" });
    }

    // Check if the record belongs to the counselor
    const counselorName = userInfo.userName;
    const counselorEmail = req.user?.email;
    
    // Allow deletion if the record's counselor matches the authenticated user
    const isOwner = record.counselor === counselorName || 
                   record.counselor === counselorEmail ||
                   (req.user?.email && record.counselor === req.user.email) ||
                   (req.user?.name && record.counselor === req.user.name);

    if (!isOwner && req.user?.role !== "admin") {
      return res.status(403).json({ 
        message: "You don't have permission to delete this record. Only the record owner can delete it." 
      });
    }

    // Update audit trail before deletion (soft delete approach)
    if (record.auditTrail) {
      record.auditTrail.deletedBy = userInfo;
      record.auditTrail.deletedAt = new Date();
      await record.save();
    }

    // Delete the record
    await Record.findByIdAndDelete(req.params.id);

    // ✅ Create notification for admins
    try {
      await createNotification({
        title: "Record Deleted",
        description: `${userInfo.userName} (${userInfo.userRole}) deleted record for client: ${record.clientName} - Session ${record.sessionNumber}`,
        category: "User Activity",
        priority: "high",
        metadata: {
          clientName: record.clientName,
          recordId: req.params.id,
          deletedBy: userInfo.userName,
          deletedByRole: userInfo.userRole,
          sessionNumber: record.sessionNumber,
        },
        relatedId: req.params.id,
        relatedType: "record",
      });
    } catch (notificationError) {
      console.error("⚠️ Admin notification creation failed (non-critical):", notificationError);
    }

    // ✅ Create notification for the counselor who deleted the record
    try {
      if (req.user?._id || req.user?.id) {
        await createCounselorNotification({
          counselorId: req.user._id || req.user.id,
          counselorEmail: req.user.email,
          title: "Record Deleted",
          description: `You have successfully deleted the record for ${record.clientName} (Session ${record.sessionNumber}).`,
          category: "System Alert",
          priority: "medium",
          metadata: {
            clientName: record.clientName,
            recordId: req.params.id,
            sessionNumber: record.sessionNumber,
            deletedAt: new Date().toISOString(),
          },
          relatedId: req.params.id,
          relatedType: "record",
        });
      }
    } catch (notificationError) {
      console.error("⚠️ Counselor notification creation failed (non-critical):", notificationError);
    }

    res.status(200).json({ 
      message: "Record deleted successfully",
      deletedRecordId: req.params.id,
    });
  } catch (err) {
    console.error("❌ Error deleting record:", err);
    res.status(500).json({ message: "Failed to delete record", error: err.message });
  }
};