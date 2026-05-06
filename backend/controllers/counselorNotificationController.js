import CounselorNotification from "../models/CounselorNotification.js";
import Counselor from "../models/Counselor.js";
import { cacheInvalidate } from "../utils/cache.js";
import { hmac } from "../utils/fieldCrypto.js";

const invalidateCounselorNotifs = () => cacheInvalidate("notifications:");

// counselorEmail is encrypted at rest, so equality matches go through the
// deterministic counselorEmailLookup HMAC column.
const counselorScopeOr = (counselorId, counselorEmail) => {
  const or = [];
  if (counselorId) or.push({ counselorId });
  if (counselorEmail) or.push({ counselorEmailLookup: hmac(counselorEmail, "email") });
  return or;
};

// Get all notifications for a specific counselor with filters and pagination
export const getCounselorNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = "all", category = "all", search = "" } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get counselor ID from authenticated user
    const counselorId = req.user?._id || req.user?.id;
    const counselorEmail = req.user?.email;

    if (!counselorId && !counselorEmail) {
      console.error("❌ No counselor ID or email found in request.user:", req.user);
      return res.status(401).json({ message: "Unauthorized. Counselor ID not found." });
    }
    
    console.log("✅ Fetching notifications for counselor:", { counselorId, counselorEmail });

    // Build query - only get notifications for this counselor
    const baseQuery = {
      $or: counselorScopeOr(counselorId, counselorEmail),
    };

    const query = { ...baseQuery };

    if (status !== "all") {
      query.status = status;
    }

    if (category !== "all") {
      query.category = category;
    }

    // Add search functionality - search in title and description
    if (search && search.trim() !== "") {
      query.$and = [
        baseQuery,
        {
          $or: [
            { title: { $regex: search.trim(), $options: "i" } },
            { description: { $regex: search.trim(), $options: "i" } },
          ],
        },
      ];
    }

    // Get notifications with pagination, sorted by date (newest first), then by priority
    console.log("🔍 Query for notifications:", JSON.stringify(query, null, 2));
    const notifications = await CounselorNotification.find(query)
      .sort({ createdAt: -1, priority: -1 }) // Newest first, then by priority
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    console.log(`✅ Found ${notifications.length} notifications`);

    // Get total count for this counselor
    const total = await CounselorNotification.countDocuments(query);

    // Get unread count for this counselor
    const unreadQuery = {
      $or: counselorScopeOr(counselorId, counselorEmail),
      status: "unread",
    };
    const unreadCount = await CounselorNotification.countDocuments(unreadQuery);

    // Format response
    const formattedNotifications = notifications.map((notification) => ({
      id: notification._id,
      title: notification.title,
      description: notification.description,
      category: notification.category,
      status: notification.status,
      priority: notification.priority,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      metadata: notification.metadata,
      relatedId: notification.relatedId,
      relatedType: notification.relatedType,
      isAnnouncement: notification.isAnnouncement || false,
    }));

    res.status(200).json({
      notifications: formattedNotifications,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      total,
      unreadCount,
    });
  } catch (error) {
    console.error("❌ Error fetching counselor notifications:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      message: "Error fetching notifications",
      error: process.env.NODE_ENV === "development" ? error.message : undefined 
    });
  }
};

// Get unread count only (for badge)
export const getUnreadCount = async (req, res) => {
  try {
    const counselorId = req.user?._id || req.user?.id;
    const counselorEmail = req.user?.email;

    if (!counselorId) {
      return res.status(401).json({ message: "Unauthorized. Counselor ID not found." });
    }

    const unreadQuery = {
      $or: counselorScopeOr(counselorId, counselorEmail),
      status: "unread",
    };

    const unreadCount = await CounselorNotification.countDocuments(unreadQuery);

    res.status(200).json({
      unreadCount,
    });
  } catch (error) {
    console.error("❌ Error fetching unread count:", error);
    res.status(500).json({ message: "Error fetching unread count" });
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const counselorId = req.user?._id || req.user?.id;
    const counselorEmail = req.user?.email;

    if (!counselorId) {
      return res.status(401).json({ message: "Unauthorized. Counselor ID not found." });
    }

    // Verify the notification belongs to this counselor
    const notification = await CounselorNotification.findOne({
      _id: notificationId,
      $or: counselorScopeOr(counselorId, counselorEmail),
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found or access denied" });
    }

    notification.status = "read";
    await notification.save();
    invalidateCounselorNotifs();

    res.status(200).json({
      message: "Notification marked as read",
      notification: {
        id: notification._id,
        status: notification.status,
      },
    });
  } catch (error) {
    console.error("❌ Error marking notification as read:", error);
    res.status(500).json({ message: "Error updating notification" });
  }
};

// Mark notification as unread
export const markAsUnread = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const counselorId = req.user?._id || req.user?.id;
    const counselorEmail = req.user?.email;

    if (!counselorId) {
      return res.status(401).json({ message: "Unauthorized. Counselor ID not found." });
    }

    // Verify the notification belongs to this counselor
    const notification = await CounselorNotification.findOne({
      _id: notificationId,
      $or: counselorScopeOr(counselorId, counselorEmail),
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found or access denied" });
    }

    notification.status = "unread";
    await notification.save();
    invalidateCounselorNotifs();

    res.status(200).json({
      message: "Notification marked as unread",
      notification: {
        id: notification._id,
        status: notification.status,
      },
    });
  } catch (error) {
    console.error("❌ Error marking notification as unread:", error);
    res.status(500).json({ message: "Error updating notification" });
  }
};

// Mark all as read for this counselor
export const markAllAsRead = async (req, res) => {
  try {
    const counselorId = req.user?._id || req.user?.id;
    const counselorEmail = req.user?.email;

    if (!counselorId) {
      return res.status(401).json({ message: "Unauthorized. Counselor ID not found." });
    }

    const query = {
      $or: counselorScopeOr(counselorId, counselorEmail),
      status: "unread",
    };

    await CounselorNotification.updateMany(query, { status: "read" });
    invalidateCounselorNotifs();

    res.status(200).json({
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("❌ Error marking all as read:", error);
    res.status(500).json({ message: "Error updating notifications" });
  }
};

// Delete a notification
export const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const counselorId = req.user?._id || req.user?.id;
    const counselorEmail = req.user?.email;

    if (!counselorId) {
      return res.status(401).json({ message: "Unauthorized. Counselor ID not found." });
    }

    // Verify the notification belongs to this counselor
    const notification = await CounselorNotification.findOneAndDelete({
      _id: notificationId,
      $or: counselorScopeOr(counselorId, counselorEmail),
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found or access denied" });
    }

    invalidateCounselorNotifs();
    res.status(200).json({
      message: "Notification deleted successfully",
      notificationId: notification._id,
    });
  } catch (error) {
    console.error("❌ Error deleting notification:", error);
    res.status(500).json({ message: "Error deleting notification" });
  }
};

// Delete all read notifications for this counselor
export const deleteAllRead = async (req, res) => {
  try {
    const counselorId = req.user?._id || req.user?.id;
    const counselorEmail = req.user?.email;

    if (!counselorId) {
      return res.status(401).json({ message: "Unauthorized. Counselor ID not found." });
    }

    const query = {
      $or: counselorScopeOr(counselorId, counselorEmail),
      status: "read",
    };

    const result = await CounselorNotification.deleteMany(query);
    invalidateCounselorNotifs();

    res.status(200).json({
      message: "All read notifications deleted",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("❌ Error deleting read notifications:", error);
    res.status(500).json({ message: "Error deleting notifications" });
  }
};

// Helper function to create a counselor notification (called from other controllers)
export const createCounselorNotification = async (data) => {
  try {
    const { counselorId, counselorEmail, title, description, category, priority, metadata, relatedId, relatedType, isAnnouncement, announcementId } = data;

    if (!counselorId && !counselorEmail) {
      throw new Error("Counselor ID or email is required");
    }

    const notification = await CounselorNotification.create({
      counselorId: counselorId || null,
      counselorEmail: counselorEmail || null,
      title,
      description,
      category: category || "System Alert",
      priority: priority || "medium",
      status: "unread",
      metadata: metadata || {},
      relatedId,
      relatedType: relatedType || "system",
      isAnnouncement: isAnnouncement || false,
      announcementId: announcementId || null,
    });

    invalidateCounselorNotifs();
    return notification;
  } catch (error) {
    console.error("❌ Error creating counselor notification:", error);
    throw error;
  }
};

// Helper function to create notifications for all counselors (for announcements)
export const createNotificationForAllCounselors = async (data) => {
  try {
    const { title, description, category, priority, metadata, relatedId, relatedType, isAnnouncement, announcementId } = data;

    // Get all counselors from BOTH Counselor and GoogleUser collections.
    const GoogleUser = (await import("../models/GoogleUser.js")).default;
    const [counselorDocs, googleUserDocs] = await Promise.all([
      Counselor.find({ role: "counselor" }).select("_id email").lean(),
      GoogleUser.find({
        $or: [{ role: "counselor" }, { role: { $exists: false } }, { role: null }],
      })
        .select("_id email")
        .lean(),
    ]);

    const seenEmails = new Set();
    const counselors = [];
    for (const doc of [...(counselorDocs || []), ...(googleUserDocs || [])]) {
      if (!doc?._id || !doc?.email) continue;
      const key = String(doc.email).toLowerCase();
      if (seenEmails.has(key)) continue;
      seenEmails.add(key);
      counselors.push(doc);
    }

    if (counselors.length === 0) {
      console.log("⚠️ No counselors found to send notification to");
      return [];
    }

    // Create notifications for each counselor
    const notifications = [];
    for (const counselor of counselors) {
      try {
        const notification = await CounselorNotification.create({
          counselorId: counselor._id,
          counselorEmail: counselor.email,
          title,
          description,
          category: category || "Announcement",
          priority: priority || "medium",
          status: "unread",
          metadata: metadata || {},
          relatedId,
          relatedType: relatedType || "announcement",
          isAnnouncement: isAnnouncement || true,
          announcementId: announcementId || null,
        });
        notifications.push(notification);
      } catch (error) {
        console.error(`❌ Error creating notification for counselor ${counselor.email}:`, error);
      }
    }

    if (notifications.length > 0) invalidateCounselorNotifs();
    return notifications;
  } catch (error) {
    console.error("❌ Error creating notifications for all counselors:", error);
    throw error;
  }
};

// Backfill: ensure every active "all" announcement has a notification per
// counselor (Counselor + GoogleUser). Past broadcasts skipped GoogleUsers.
export const backfillAnnouncementNotifications = async () => {
  try {
    const Announcement = (await import("../models/Announcement.js")).default;
    const GoogleUser = (await import("../models/GoogleUser.js")).default;

    // Only consider announcements that have never been backfilled. Once an
    // announcement is backfilled we never re-create notifications for it,
    // otherwise users can never permanently delete those notifications.
    const announcements = await Announcement.find({
      isActive: true,
      targetAudience: "all",
      $or: [{ notificationsBackfilled: { $exists: false } }, { notificationsBackfilled: false }],
    })
      .sort({ createdAt: -1 })
      .lean();
    if (!announcements.length) return { announcements: 0, created: 0 };

    const [counselorDocs, googleUserDocs] = await Promise.all([
      Counselor.find({ role: "counselor" }).select("_id email").lean(),
      GoogleUser.find({
        $or: [{ role: "counselor" }, { role: { $exists: false } }, { role: null }],
      })
        .select("_id email")
        .lean(),
    ]);

    const seen = new Set();
    const counselors = [];
    for (const doc of [...counselorDocs, ...googleUserDocs]) {
      if (!doc?._id || !doc?.email) continue;
      const k = String(doc.email).toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      counselors.push(doc);
    }

    let created = 0;
    for (const ann of announcements) {
      const existing = await CounselorNotification.find({ announcementId: ann._id })
        .select("counselorEmail")
        .lean();
      const haveEmails = new Set(
        existing.map((e) => String(e.counselorEmail || "").toLowerCase()).filter(Boolean)
      );
      const missing = counselors.filter(
        (c) => !haveEmails.has(String(c.email).toLowerCase())
      );
      if (!missing.length) continue;

      const docs = missing.map((c) => ({
        counselorId: c._id,
        counselorEmail: c.email,
        title: ann.title,
        description: ann.message,
        category: "Announcement",
        priority: ann.priority || "medium",
        status: "unread",
        metadata: { announcementId: ann._id.toString(), createdBy: ann.createdByName },
        relatedId: ann._id,
        relatedType: "announcement",
        isAnnouncement: true,
        announcementId: ann._id,
        createdAt: ann.createdAt,
        updatedAt: ann.updatedAt,
      }));
      const inserted = await CounselorNotification.insertMany(docs, { ordered: false });
      created += inserted.length;
      await Announcement.updateOne(
        { _id: ann._id },
        { $set: { notificationsBackfilled: true } }
      );
    }

    if (created > 0) invalidateCounselorNotifs();

    // Mark every processed announcement as backfilled (even ones that had no
    // missing notifications) so we never reprocess them — otherwise deletions
    // by the counselor would silently come back on the next server restart.
    await Announcement.updateMany(
      { _id: { $in: announcements.map((a) => a._id) } },
      { $set: { notificationsBackfilled: true } }
    );

    console.log(
      `📣 Announcement backfill: ${announcements.length} announcement(s), created ${created} missing notification(s)`
    );
    return { announcements: announcements.length, created };
  } catch (error) {
    console.error("❌ Announcement backfill failed:", error);
    return { announcements: 0, created: 0, error: error.message };
  }
};

