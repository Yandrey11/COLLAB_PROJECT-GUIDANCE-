import mongoose from "mongoose";

const analyticsEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true,
      enum: [
        // Record events
        "record_created",
        "record_updated",
        "record_deleted",
        "record_locked",
        "record_unlocked",
        // PDF events
        "pdf_generated",
        "pdf_downloaded",
        // Google Drive events
        "drive_uploaded",
        "drive_connected",
        "drive_disconnected",
        // Page visit events
        "page_visit",
        // User events
        "user_login",
        "user_logout",
        "user_created",
        "user_updated",
        "user_deleted",
        // Report events
        "report_generated",
        "report_viewed",
        // System events
        "backup_created",
        "backup_restored",
        "notification_sent",
      ],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "userModel",
    },
    userModel: {
      type: String,
      enum: ["Counselor", "GoogleUser", "Admin"],
    },
    userName: {
      type: String,
    },
    userEmail: {
      type: String,
    },
    userRole: {
      type: String,
      enum: ["counselor", "admin"],
    },
    // For page visits
    pageName: {
      type: String,
      enum: [
        "Dashboard",
        "Records Page",
        "Reports Page",
        "Notification Center",
        "Settings",
        "Profile",
        "Admin Dashboard",
        "User Management",
        "Record Management",
        "Backup & Restore",
        "Analytics",
      ],
    },
    // Metadata for additional context
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // IP and user agent for page visits
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    // Date fields for easy querying
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    year: {
      type: Number,
      index: true,
    },
    month: {
      type: Number,
      index: true,
    },
    week: {
      type: Number,
      index: true,
    },
    day: {
      type: Number,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
analyticsEventSchema.index({ eventType: 1, date: -1 });
analyticsEventSchema.index({ userId: 1, date: -1 });
analyticsEventSchema.index({ userRole: 1, date: -1 });
analyticsEventSchema.index({ pageName: 1, date: -1 });
analyticsEventSchema.index({ year: 1, month: 1, day: 1 });
analyticsEventSchema.index({ createdAt: -1 });

// Pre-save hook to set date fields
analyticsEventSchema.pre("save", function (next) {
  if (this.date) {
    const date = new Date(this.date);
    this.year = date.getFullYear();
    this.month = date.getMonth() + 1; // 1-12
    this.week = getWeekNumber(date);
    this.day = date.getDate(); // 1-31
  }
  next();
});

// Helper function to get week number
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

const AnalyticsEvent = mongoose.models.AnalyticsEvent || mongoose.model("AnalyticsEvent", analyticsEventSchema);

export default AnalyticsEvent;

