import mongoose from "mongoose";

const counselorSettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
      refPath: "userModel",
    },
    userModel: {
      type: String,
      required: true,
      enum: ["Counselor", "GoogleUser"],
    },
    userEmail: {
      type: String,
      required: true,
    },

    // Display & Interface Settings
    display: {
      theme: {
        type: String,
        enum: ["light", "dark"],
        default: "light",
      },
      uiDensity: {
        type: String,
        enum: ["compact", "normal"],
        default: "normal",
      },
      defaultDashboardView: {
        type: String,
        enum: ["calendar", "records", "notifications"],
        default: "calendar",
      },
    },

    // Notification Settings
    notifications: {
      recordUpdates: {
        type: Boolean,
        default: true,
      },
      adminAnnouncements: {
        type: Boolean,
        default: true,
      },
      googleCalendarSync: {
        type: Boolean,
        default: true,
      },
      soundEnabled: {
        type: Boolean,
        default: false,
      },
    },

    // Google Calendar Display Settings (Frontend only - stored for persistence)
    googleCalendar: {
      showOnDashboard: {
        type: Boolean,
        default: true,
      },
      preferredView: {
        type: String,
        enum: ["day", "week", "month"],
        default: "month",
      },
    },

    // Privacy Settings
    privacy: {
      hideProfilePhoto: {
        type: Boolean,
        default: false,
      },
      maskNameInPDFs: {
        type: Boolean,
        default: false,
      },
    },
  },
  { timestamps: true }
);

// Index for faster lookups
counselorSettingsSchema.index({ userId: 1, userModel: 1 });
counselorSettingsSchema.index({ userEmail: 1 });

// Static method to get or create settings
counselorSettingsSchema.statics.getOrCreateSettings = async function (userId, userModel, userEmail) {
  let settings = await this.findOne({ userId, userModel });
  if (!settings) {
    settings = await this.create({
      userId,
      userModel,
      userEmail,
    });
  }
  return settings;
};

const CounselorSettings =
  mongoose.models.CounselorSettings ||
  mongoose.model("CounselorSettings", counselorSettingsSchema);

export default CounselorSettings;

