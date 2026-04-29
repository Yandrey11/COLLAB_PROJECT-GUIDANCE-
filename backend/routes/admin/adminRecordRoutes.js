import express from "express";
import {
  getAllRecords,
  getRecordById,
  deleteRecord,
  patchRecordRecommendation,
} from "../../controllers/admin/adminRecordController.js";
import {
  lockRecord,
  unlockRecord,
  getLockStatus,
  getLockLogs,
  getAllLockLogs,
  startEditing,
} from "../../controllers/admin/recordLockController.js";
import { protectAdmin } from "../../middleware/admin/adminMiddleware.js";

const router = express.Router();

// All routes require admin authentication
router.use(protectAdmin);

// Get all records with search, filter, and pagination
router.get("/records", getAllRecords);

// Get single record by ID
router.get("/records/:id", getRecordById);

// Admin recommendation (no edit lock)
router.patch("/records/:id/recommendation", patchRecordRecommendation);

// Lock/Unlock routes
router.post("/records/:id/lock", lockRecord);
router.post("/records/:id/unlock", unlockRecord);
router.post("/records/:id/start-editing", startEditing); // Auto-lock when editing starts
router.get("/records/:id/lock-status", getLockStatus);
router.get("/records/:id/lock-logs", getLockLogs);
router.get("/lock-logs/all", getAllLockLogs); // Get all recent lock/unlock logs

// Full record updates are not allowed for admins (view + recommendation only)
router.put("/records/:id", (req, res) => {
  res.status(403).json({
    success: false,
    message:
      "Administrators cannot edit counseling records. View the record or use Add recommendation.",
  });
});

// Delete record
router.delete("/records/:id", deleteRecord);

export default router;

