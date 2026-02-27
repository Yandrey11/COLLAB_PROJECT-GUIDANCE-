import CounselorNotification from "../models/CounselorNotification.js";
import Counselor from "../models/Counselor.js";

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
      $or: [{ counselorId: counselorId }, { counselorEmail: counselorEmail }],
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
      $or: [{ counselorId: counselorId }, { counselorEmail: counselorEmail }],
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
      $or: [{ counselorId: counselorId }, { counselorEmail: counselorEmail }],
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
      $or: [{ counselorId: counselorId }, { counselorEmail: counselorEmail }],
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found or access denied" });
    }

    notification.status = "read";
    await notification.save();

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
      $or: [{ counselorId: counselorId }, { counselorEmail: counselorEmail }],
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found or access denied" });
    }

    notification.status = "unread";
    await notification.save();

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
      $or: [{ counselorId: counselorId }, { counselorEmail: counselorEmail }],
      status: "unread",
    };

    await CounselorNotification.updateMany(query, { status: "read" });

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
      $or: [{ counselorId: counselorId }, { counselorEmail: counselorEmail }],
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found or access denied" });
    }

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
      $or: [{ counselorId: counselorId }, { counselorEmail: counselorEmail }],
      status: "read",
    };

    const result = await CounselorNotification.deleteMany(query);

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

    // Get all counselors
    const counselors = await Counselor.find({ role: "counselor" }).select("_id email").lean();

    if (!counselors || counselors.length === 0) {
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

    return notifications;
  } catch (error) {
    console.error("❌ Error creating notifications for all counselors:", error);
    throw error;
  }
};

