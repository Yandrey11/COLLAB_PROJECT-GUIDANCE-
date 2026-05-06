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
import { cacheJSON } from "../../utils/cache.js";

const router = express.Router();

// All routes require admin authentication except logEvent (system endpoint)
router.use(protectAdmin);

// Cache analytics responses for 60 s. Invalidated on record/notification writes
// via cacheInvalidate("analytics:") in the corresponding controllers.
const analyticsCache = cacheJSON({ ttlMs: 60_000, prefix: "analytics:" });

// Get analytics overview (summary cards)
router.get("/overview", analyticsCache, getAnalyticsOverview);

// Get page visits analytics
router.get("/page-visits", analyticsCache, getPageVisits);

// Get events analytics
router.get("/events", analyticsCache, getEvents);

// Get record status distribution
router.get("/record-status-distribution", analyticsCache, getRecordStatusDistribution);

// Get daily records created
router.get("/daily-records", analyticsCache, getDailyRecordsCreated);

// Consultations (records) by month/quarter and session type
router.get("/consultation-volume", analyticsCache, getConsultationVolumeByPeriod);
router.get("/record-volume", analyticsCache, getRecordVolumeByPeriod);
router.get("/problems-presented", analyticsCache, getProblemsPresentedByPeriod);
router.get("/gender-distribution", analyticsCache, getGenderDistributionByPeriod);
router.get("/course-distribution", analyticsCache, getCourseDistributionByPeriod);

export default router;

