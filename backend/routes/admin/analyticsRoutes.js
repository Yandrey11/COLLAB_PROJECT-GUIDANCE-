import express from "express";
import {
  getAnalyticsOverview,
  getPageVisits,
  getEvents,
  getRecordStatusDistribution,
  getDailyRecordsCreated,
  getConsultationVolumeByPeriod,
  getRecordVolumeByPeriod,
  getProblemsPresentedByPeriod,
  getGenderDistributionByPeriod,
  getCourseDistributionByPeriod,
  logEvent,
} from "../../controllers/admin/analyticsController.js";
import { protectAdmin } from "../../middleware/admin/adminMiddleware.js";

const router = express.Router();

// All routes require admin authentication except logEvent (system endpoint)
router.use(protectAdmin);

// Get analytics overview (summary cards)
router.get("/overview", getAnalyticsOverview);

// Get page visits analytics
router.get("/page-visits", getPageVisits);

// Get events analytics
router.get("/events", getEvents);

// Get record status distribution
router.get("/record-status-distribution", getRecordStatusDistribution);

// Get daily records created
router.get("/daily-records", getDailyRecordsCreated);

// Consultations (records) by month/quarter and session type
router.get("/consultation-volume", getConsultationVolumeByPeriod);
router.get("/record-volume", getRecordVolumeByPeriod);
router.get("/problems-presented", getProblemsPresentedByPeriod);
router.get("/gender-distribution", getGenderDistributionByPeriod);
router.get("/course-distribution", getCourseDistributionByPeriod);

export default router;

