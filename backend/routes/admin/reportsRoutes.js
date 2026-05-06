import express from "express";
import {
  getReportsOverview,
  getFilteredRecords,
  generateCounselingSummaryPdfAdmin,
  generateReport,
  getAllReports,
  getReportById,
  downloadReport,
  downloadReportPDF,
  getCounselorsList,
} from "../../controllers/admin/reportsController.js";
import { protectAdmin } from "../../middleware/admin/adminMiddleware.js";

const router = express.Router();

// All routes require admin authentication
router.use(protectAdmin);

// Get reports dashboard overview (summary cards)
router.get("/overview", getReportsOverview);

// Get counselors list for filter dropdown
router.get("/counselors", getCounselorsList);

// Get filtered records for report generation
router.get("/records", getFilteredRecords);

// Get all generated reports
router.get("/", getAllReports);

// Get report by ID
router.get("/:id", getReportById);

// Download report PDF file directly
router.get("/:id/download-pdf", downloadReportPDF);

// Download report (returns Drive link)
router.get("/:id/download", downloadReport);

// Stream counseling summary table PDF (filters in body; no modal / report name)
router.post("/summary-pdf", generateCounselingSummaryPdfAdmin);

// Generate new report
router.post("/generate", generateReport);

export default router;

