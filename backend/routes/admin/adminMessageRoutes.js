import express from "express";
import { protectAdmin } from "../../middleware/admin/adminMiddleware.js";
import {
  getAdminMessageThreads,
  getAdminMessagesForCounselor,
  postAdminMessageToCounselor,
  markAdminThreadRead,
  getAdminUnreadMessageTotal,
} from "../../controllers/admin/adminCounselorMessageController.js";

const router = express.Router();
router.use(protectAdmin);

router.get("/messages/unread-total", getAdminUnreadMessageTotal);
router.get("/messages/threads", getAdminMessageThreads);
router.get("/messages/counselor/:counselorId", getAdminMessagesForCounselor);
router.post("/messages/counselor/:counselorId/mark-read", markAdminThreadRead);
router.post("/messages/counselor/:counselorId", postAdminMessageToCounselor);

export default router;
