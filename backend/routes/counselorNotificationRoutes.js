import express from "express";
import {
  getCounselorNotifications,
  getUnreadCount,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  deleteNotification,
  deleteAllRead,
} from "../controllers/counselorNotificationController.js";
import { protect } from "../middleware/authMiddleware.js";
import { cacheJSON } from "../utils/cache.js";
import Announcement from "../models/Announcement.js";

const router = express.Router();

// All routes require authentication (counselor/admin authentication)
router.use(protect);

// Cache reads for 15s; invalidated on mark-read / delete in the controller.
const notifCache = cacheJSON({ ttlMs: 15_000, prefix: "notifications:" });

// Latest active announcement (source-of-truth: Announcement collection).
// This bypasses the per-counselor CounselorNotification fan-out so the
// dashboard widget works even if the user never received a notification doc.
router.get("/latest-announcement", async (req, res) => {
  try {
    const counselorId = req.user?._id?.toString?.() || null;
    console.log("📣 [latest-announcement] hit by", req.user?.email, "id=", counselorId);
    const baseFilter = { isActive: true };
    const audienceFilter = counselorId
      ? {
          $or: [
            { targetAudience: "all" },
            { targetAudience: { $exists: false } },
            { targetAudience: "specific", targetCounselorIds: counselorId },
          ],
        }
      : { $or: [{ targetAudience: "all" }, { targetAudience: { $exists: false } }] };

    const ann = await Announcement.findOne({ ...baseFilter, ...audienceFilter })
      .sort({ createdAt: -1 })
      .lean();

    if (!ann) return res.status(200).json({ announcement: null });

    return res.status(200).json({
      announcement: {
        id: ann._id,
        title: ann.title,
        description: ann.message,
        category: "Announcement",
        priority: ann.priority || "medium",
        createdAt: ann.createdAt,
        createdByName: ann.createdByName,
        isAnnouncement: true,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching latest announcement:", error);
    res.status(500).json({ message: "Error fetching latest announcement" });
  }
});

/** Active announcements for this counselor (newest first). */
router.get("/announcements", async (req, res) => {
  try {
    const counselorId = req.user?._id?.toString?.() || null;
    const baseFilter = { isActive: true };
    const audienceFilter = counselorId
      ? {
          $or: [
            { targetAudience: "all" },
            { targetAudience: { $exists: false } },
            { targetAudience: "specific", targetCounselorIds: counselorId },
          ],
        }
      : { $or: [{ targetAudience: "all" }, { targetAudience: { $exists: false } }] };

    const list = await Announcement.find({ ...baseFilter, ...audienceFilter })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const announcements = list.map((ann) => ({
      id: ann._id,
      title: ann.title,
      description: ann.message,
      category: "Announcement",
      priority: ann.priority || "medium",
      createdAt: ann.createdAt,
      createdByName: ann.createdByName,
      isAnnouncement: true,
    }));

    return res.status(200).json({ announcements });
  } catch (error) {
    console.error("❌ Error fetching counselor announcements:", error);
    res.status(500).json({ message: "Error fetching announcements" });
  }
});

// Get all notifications for the authenticated counselor with filters and pagination
router.get("/", notifCache, getCounselorNotifications);

// Get unread count only (for badge)
router.get("/unread-count", notifCache, getUnreadCount);

// Mark notification as read
router.put("/:notificationId/read", markAsRead);

// Mark notification as unread
router.put("/:notificationId/unread", markAsUnread);

// Mark all notifications as read for this counselor
router.put("/read-all", markAllAsRead);

// Delete a notification
router.delete("/:notificationId", deleteNotification);

// Delete all read notifications for this counselor
router.delete("/read/all", deleteAllRead);

export default router;

