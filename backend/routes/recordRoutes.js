import express from "express";

import {
  getRecords,
  updateRecord,
  uploadToDrive,
  createRecord,
  deleteRecord,
  generateRecordPDF,
  generateSummaryRecordsPDF,
  syncAllRecordsToGoogleCalendar,
  syncRecordsToDrive,
  getRecordCatalogOptions,
  archiveRecord,
  unarchiveRecord,
  getShareTargets,
  shareRecordWithCounselor,
  unshareRecordWithCounselor,
} from "../controllers/recordController.js";
import {
  lockRecord,
  unlockRecord,
  getLockStatus,
  getLockLogs,
  getAllLockLogs,
  checkLockBeforeUpdate,
  startEditing,
} from "../controllers/admin/recordLockController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/permissionMiddleware.js";
import { sensitiveWriteLimiter, uploadLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();

// View records - requires can_view_records permission
router.get("/", protect, authorize("can_view_records"), getRecords);
router.get("/catalog-options", protect, authorize("can_view_records"), getRecordCatalogOptions);

// Sync all records to Google Calendar (for existing records)
router.post(
  "/sync-google-calendar",
  sensitiveWriteLimiter,
  protect,
  authorize("can_edit_records"),
  syncAllRecordsToGoogleCalendar
);

// Sync records without Drive link to logged-in user's Google Drive
router.post("/sync-drive", sensitiveWriteLimiter, protect, authorize("can_edit_records"), syncRecordsToDrive);

// Multi-record counseling summary PDF (must be before /:id routes)
router.post("/summary-pdf", sensitiveWriteLimiter, protect, authorize("can_view_records"), generateSummaryRecordsPDF);

// Generate PDF for a single record - requires can_view_records permission
router.get("/:id/generate-pdf", protect, authorize("can_view_records"), generateRecordPDF);
router.get("/:id/share-targets", protect, authorize("can_view_records"), getShareTargets);
router.post("/:id/share", sensitiveWriteLimiter, protect, authorize("can_edit_records"), shareRecordWithCounselor);
router.post("/:id/unshare", sensitiveWriteLimiter, protect, authorize("can_edit_records"), unshareRecordWithCounselor);

// Lock/Unlock routes (for counselors)
// CRITICAL: More specific routes (with additional path segments) MUST come before less specific /:id routes
router.get("/lock-logs/all", protect, authorize("can_view_records"), getAllLockLogs); // Get all recent lock/unlock logs
router.post("/:id/archive", sensitiveWriteLimiter, protect, authorize("can_edit_records"), archiveRecord);
router.post("/:id/unarchive", sensitiveWriteLimiter, protect, authorize("can_edit_records"), unarchiveRecord);
router.post("/:id/start-editing", sensitiveWriteLimiter, protect, authorize("can_edit_records"), startEditing); // Auto-lock when editing starts
router.get("/:id/lock-status", protect, authorize("can_view_records"), getLockStatus);
router.get("/:id/lock-logs", protect, authorize("can_view_records"), getLockLogs);
router.post("/:id/upload-drive", uploadLimiter, protect, authorize("can_edit_records"), uploadToDrive);
router.post("/:id/lock", sensitiveWriteLimiter, protect, authorize("can_view_records"), lockRecord);
router.post("/:id/unlock", sensitiveWriteLimiter, protect, authorize("can_view_records"), unlockRecord);

// Edit/Update records - requires can_edit_records permission
router.put("/:id", sensitiveWriteLimiter, protect, authorize("can_edit_records"), checkLockBeforeUpdate, updateRecord);
router.post("/", sensitiveWriteLimiter, protect, authorize("can_edit_records"), createRecord); // ✅ Require authentication and permission to create records
router.delete("/:id", sensitiveWriteLimiter, protect, authorize("can_edit_records"), deleteRecord); // ✅ Require permission to delete records

export default router;
