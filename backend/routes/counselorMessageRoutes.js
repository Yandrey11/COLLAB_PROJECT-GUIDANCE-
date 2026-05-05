import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getCounselorMessages,
  postCounselorMessage,
  markCounselorMessagesRead,
  getCounselorUnreadMessageCount,
} from "../controllers/counselorMessageController.js";

const router = express.Router();
router.use(protect);

router.get("/unread-count", getCounselorUnreadMessageCount);
router.post("/mark-read", markCounselorMessagesRead);
router.get("/", getCounselorMessages);
router.post("/", postCounselorMessage);

export default router;
