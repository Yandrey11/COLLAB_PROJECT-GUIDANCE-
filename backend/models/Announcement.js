import mongoose from "mongoose";

// Model for admin-created announcements that can be sent to all counselors
const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    createdByName: {
      type: String,
      required: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    targetAudience: {
      type: String,
      enum: ["all", "specific"],
      default: "all",
    },
    targetCounselorIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Counselor",
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
      // Optional expiration date for announcements
    },
    notificationsBackfilled: {
      type: Boolean,
      default: false,
      // Set to true after the one-time fan-out so a counselor's manual
      // delete cannot be undone by the startup backfill job.
    },
  },
  { timestamps: true }
);

announcementSchema.index({ isActive: 1, createdAt: -1 });
announcementSchema.index({ createdBy: 1 });

const Announcement =
  mongoose.models.Announcement || mongoose.model("Announcement", announcementSchema);

export default Announcement;

