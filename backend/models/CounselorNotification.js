import mongoose from "mongoose";

const counselorNotificationSchema = new mongoose.Schema(
  {
    counselorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Counselor",
      required: true,
      index: true,
    },
    counselorEmail: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: [
        "New Record",
        "Assigned Record",
        "Updated Record",
        "Schedule Reminder",
        "Announcement",
        "System Alert",
        "Record Request",
      ],
      default: "System Alert",
      required: true,
    },
    status: {
      type: String,
      enum: ["read", "unread"],
      default: "unread",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // Can include: recordId, clientName, sessionNumber, adminId, etc.
    },
    // For linking to specific resources
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      // Can be Record ID, Admin ID, etc.
    },
    relatedType: {
      type: String,
      enum: ["record", "announcement", "schedule", "system"],
      default: "system",
    },
    // For admin-created announcements sent to all counselors
    isAnnouncement: {
      type: Boolean,
      default: false,
    },
    announcementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Announcement",
      // Reference to announcement if this is part of a broadcast
    },
  },
  { timestamps: true }
);

// Indexes for faster queries
counselorNotificationSchema.index({ counselorId: 1, status: 1, createdAt: -1 });
counselorNotificationSchema.index({ counselorEmail: 1, status: 1 });
counselorNotificationSchema.index({ category: 1, createdAt: -1 });
counselorNotificationSchema.index({ priority: 1, createdAt: -1 });
counselorNotificationSchema.index({ createdAt: -1 });

const CounselorNotification =
  mongoose.models.CounselorNotification ||
  mongoose.model("CounselorNotification", counselorNotificationSchema);

export default CounselorNotification;

