import express from "express";
import {
  getSettings,
  updateDisplaySettings,
  updateNotificationSettings,
  updatePrivacySettings,
  updateColorSettings,
  resetColorSettings,
} from "../../controllers/admin/adminSettingsController.js";
import { protectAdmin } from "../../middleware/admin/adminMiddleware.js";
import { cacheJSON } from "../../utils/cache.js";
import { sensitiveWriteLimiter } from "../../middleware/rateLimitMiddleware.js";

const router = express.Router();

// All routes require admin authentication
router.use(protectAdmin);

// Settings rarely change; cache 5 min per admin. Invalidated on writes.
const settingsCache = cacheJSON({ ttlMs: 5 * 60_000, prefix: "settings:" });

/**
 * @route   GET /api/admin/settings
 * @desc    Get all admin settings
 * @access  Private (Admin only)
 */
router.get("/", settingsCache, getSettings);

/**
 * @route   PUT /api/admin/settings/display
 * @desc    Update display & interface settings
 * @access  Private (Admin only)
 */
router.put("/display", sensitiveWriteLimiter, updateDisplaySettings);

/**
 * @route   PUT /api/admin/settings/notifications
 * @desc    Update notification settings
 * @access  Private (Admin only)
 */
router.put("/notifications", sensitiveWriteLimiter, updateNotificationSettings);

/**
 * @route   PUT /api/admin/settings/privacy
 * @desc    Update privacy settings
 * @access  Private (Admin only)
 */
router.put("/privacy", sensitiveWriteLimiter, updatePrivacySettings);

/**
 * @route   PUT /api/admin/settings/colors
 * @desc    Update theme color customization
 * @access  Private (Admin only)
 */
router.put("/colors", sensitiveWriteLimiter, updateColorSettings);

/**
 * @route   POST /api/admin/settings/colors/reset
 * @desc    Reset theme color customization to defaults
 * @access  Private (Admin only)
 */
router.post("/colors/reset", sensitiveWriteLimiter, resetColorSettings);

export default router;


