import Notification from "../../models/Notification.js";
import { cacheInvalidate } from "../../utils/cache.js";

const invalidateAdminNotifs = () => cacheInvalidate("notifications:");

// Get all notifications with filters and pagination
export const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = "all", category = "all", search = "" } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = {};

    if (status !== "all") {
      query.status = status;
    }

    if (category !== "all") {
      query.category = category;
    }

    // Add search functionality - search in title and description
    if (search && search.trim() !== "") {
      query.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { description: { $regex: search.trim(), $options: "i" } },
      ];
    }

    // Get notifications with pagination, sorted by priority and date
    const notifications = await Notification.find(query)
      .sort({ priority: -1, createdAt: -1 }) // Critical first, then by date
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const total = await Notification.countDocuments(query);

    // Get unread count
    const unreadCount = await Notification.countDocuments({ status: "unread" });

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
    }));

    res.status(200).json({
      notifications: formattedNotifications,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      total,
      unreadCount,
    });
  } catch (error) {
    console.error("❌ Error fetching notifications:", error);
    res.status(500).json({ message: "Error fetching notifications" });
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    notification.status = "read";
    await notification.save();
    invalidateAdminNotifs();

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

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    notification.status = "unread";
    await notification.save();
    invalidateAdminNotifs();

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

// Mark all as read
export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ status: "unread" }, { status: "read" });
    invalidateAdminNotifs();

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

    const notification = await Notification.findByIdAndDelete(notificationId);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    invalidateAdminNotifs();
    res.status(200).json({
      message: "Notification deleted successfully",
      notificationId: notification._id,
    });
  } catch (error) {
    console.error("❌ Error deleting notification:", error);
    res.status(500).json({ message: "Error deleting notification" });
  }
};

// Delete all read notifications
export const deleteAllRead = async (req, res) => {
  try {
    const result = await Notification.deleteMany({ status: "read" });
    invalidateAdminNotifs();

    res.status(200).json({
      message: "All read notifications deleted",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("❌ Error deleting read notifications:", error);
    res.status(500).json({ message: "Error deleting notifications" });
  }
};

// Helper function to create a notification (can be called from other controllers)
export const createNotification = async (data) => {
  try {
    const notification = await Notification.create({
      title: data.title,
      description: data.description,
      category: data.category || "Info",
      priority: data.priority || "medium",
      status: "unread",
      metadata: data.metadata || {},
      relatedId: data.relatedId,
      relatedType: data.relatedType,
    });

    invalidateAdminNotifs();
    return notification;
  } catch (error) {
    console.error("❌ Error creating notification:", error);
    throw error;
  }
};

