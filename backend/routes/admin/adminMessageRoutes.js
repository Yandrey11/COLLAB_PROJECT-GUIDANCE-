import express from "express";
import { protectAdmin } from "../../middleware/admin/adminMiddleware.js";
import {
  getAdminMessageThreads,
  getAdminMessagesForCounselor,
  postAdminMessageToCounselor,
  markAdminThreadRead,
  getAdminUnreadMessageTotal,
} from "../../controllers/admin/adminCounselorMessageController.js";
import { cacheJSON } from "../../utils/cache.js";
import { sensitiveWriteLimiter } from "../../middleware/rateLimitMiddleware.js";

const router = express.Router();
router.use(protectAdmin);

// Cache message reads 15s; invalidated by writes via cacheInvalidate("messages:").
const messagesCache = cacheJSON({ ttlMs: 15_000, prefix: "messages:" });

router.get("/messages/unread-total", messagesCache, getAdminUnreadMessageTotal);
router.get("/messages/threads", messagesCache, getAdminMessageThreads);
router.get("/messages/counselor/:counselorId", messagesCache, getAdminMessagesForCounselor);
router.post("/messages/counselor/:counselorId/mark-read", sensitiveWriteLimiter, markAdminThreadRead);
router.post("/messages/counselor/:counselorId", sensitiveWriteLimiter, postAdminMessageToCounselor);

export default router;
