import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "userModel",
    },
    userModel: {
      type: String,
      required: true,
      enum: ["Counselor", "GoogleUser", "Admin"],
    },
    userEmail: { type: String, required: true },
    userName: { type: String, required: true },
    activityType: {
      type: String,
      required: true,
      enum: [
        "profile_viewed",
        "profile_updated",
        "password_changed",
        "profile_picture_uploaded",
        "profile_picture_updated",
        "profile_picture_removed",
        "account_activity_viewed",
        "email_updated",
        "name_updated",
        "settings_updated",
        "display_settings_updated",
        "notification_settings_updated",
        "privacy_settings_updated",
        "login",
        "logout",
        "report_generated",
        "report_viewed",
        "report_downloaded",
      ],
    },
    description: { type: String, required: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ userEmail: 1, createdAt: -1 });
activityLogSchema.index({ activityType: 1, createdAt: -1 });

const ActivityLog = mongoose.models.ActivityLog || mongoose.model("ActivityLog", activityLogSchema);

export default ActivityLog;

