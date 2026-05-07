import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getSettings,
  updateSettings,
  resetSettings,
} from "../controllers/counselorSettingsController.js";
import { cacheJSON } from "../utils/cache.js";
import { sensitiveWriteLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();

// Settings rarely change; cache 5 min per user. Invalidated on PUT/reset.
const settingsCache = cacheJSON({ ttlMs: 5 * 60_000, prefix: "settings:" });

router.route("/").get(protect, settingsCache, getSettings).put(sensitiveWriteLimiter, protect, updateSettings);
router.post("/reset", sensitiveWriteLimiter, protect, resetSettings);

export default router;

