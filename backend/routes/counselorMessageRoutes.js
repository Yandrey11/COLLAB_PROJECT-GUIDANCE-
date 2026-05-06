import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getCounselorMessages,
  postCounselorMessage,
  markCounselorMessagesRead,
  getCounselorUnreadMessageCount,
} from "../controllers/counselorMessageController.js";
import { cacheJSON } from "../utils/cache.js";

const router = express.Router();
router.use(protect);

// Unread badge polls frequently; cache 15s per counselor.
// Invalidated on post/mark-read/admin reply via cacheInvalidate("messages:").
const messagesCache = cacheJSON({ ttlMs: 15_000, prefix: "messages:" });

router.get("/unread-count", messagesCache, getCounselorUnreadMessageCount);
router.post("/mark-read", markCounselorMessagesRead);
router.get("/", messagesCache, getCounselorMessages);
router.post("/", postCounselorMessage);

export default router;
