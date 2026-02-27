import Announcement from "../../models/Announcement.js";
import { createNotificationForAllCounselors } from "../counselorNotificationController.js";
import { createNotification } from "./notificationController.js";

// Create and send announcement to all counselors
export const createAnnouncement = async (req, res) => {
  try {
    const { title, message, priority = "medium", targetAudience = "all", targetCounselorIds = [] } = req.body;
    const adminId = req.admin?._id || req.admin?.id;
    const adminName = req.admin?.name || req.admin?.email || "Admin";

    if (!title || !message) {
      return res.status(400).json({ message: "Title and message are required" });
    }

    // Create announcement record
    const announcement = new Announcement({
      title,
      message,
      createdBy: adminId,
      createdByName: adminName,
      priority,
      targetAudience,
      targetCounselorIds: targetAudience === "specific" ? targetCounselorIds : [],
      isActive: true,
    });

    await announcement.save();

    // Send notifications to counselors
    try {
      if (targetAudience === "all") {
        // Send to all counselors
        await createNotificationForAllCounselors({
          title,
          description: message,
          category: "Announcement",
          priority,
          metadata: {
            announcementId: announcement._id.toString(),
            createdBy: adminName,
          },
          relatedId: announcement._id,
          relatedType: "announcement",
          isAnnouncement: true,
          announcementId: announcement._id,
        });
      } else if (targetAudience === "specific" && targetCounselorIds.length > 0) {
        // Send to specific counselors
        const Counselor = (await import("../../models/Counselor.js")).default;
        for (const counselorId of targetCounselorIds) {
          const counselor = await Counselor.findById(counselorId);
          if (counselor && counselor.role === "counselor") {
            const { createCounselorNotification } = await import("../counselorNotificationController.js");
            await createCounselorNotification({
              counselorId: counselor._id,
              counselorEmail: counselor.email,
              title,
              description: message,
              category: "Announcement",
              priority,
              metadata: {
                announcementId: announcement._id.toString(),
                createdBy: adminName,
              },
              relatedId: announcement._id,
              relatedType: "announcement",
              isAnnouncement: true,
              announcementId: announcement._id,
            });
          }
        }
      }

      // Also create admin notification
      await createNotification({
        title: "Announcement Created",
        description: `${adminName} created an announcement: ${title}`,
        category: "User Activity",
        priority: "low",
        metadata: {
          announcementId: announcement._id.toString(),
          targetAudience,
        },
        relatedId: announcement._id,
        relatedType: "announcement",
      });
    } catch (notificationError) {
      console.error("⚠️ Notification creation failed (non-critical):", notificationError);
    }

    res.status(201).json({
      message: "Announcement created and sent successfully",
      announcement: {
        id: announcement._id,
        title: announcement.title,
        message: announcement.message,
        createdAt: announcement.createdAt,
      },
    });
  } catch (error) {
    console.error("❌ Error creating announcement:", error);
    res.status(500).json({ message: "Error creating announcement", error: error.message });
  }
};

// Get all announcements
export const getAnnouncements = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const announcements = await Announcement.find({ isActive: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Announcement.countDocuments({ isActive: true });

    res.status(200).json({
      announcements,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        total,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching announcements:", error);
    res.status(500).json({ message: "Error fetching announcements" });
  }
};

// Deactivate announcement
export const deactivateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findById(id);

    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    announcement.isActive = false;
    await announcement.save();

    res.status(200).json({
      message: "Announcement deactivated successfully",
      announcement: {
        id: announcement._id,
        isActive: announcement.isActive,
      },
    });
  } catch (error) {
    console.error("❌ Error deactivating announcement:", error);
    res.status(500).json({ message: "Error deactivating announcement" });
  }
};

