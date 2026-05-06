import Admin from "../../models/Admin.js";
import ActivityLog from "../../models/ActivityLog.js";
import { cacheInvalidate } from "../../utils/cache.js";

// Helper function to get client IP and user agent
const getClientInfo = (req) => ({
  ipAddress: req.ip || req.connection.remoteAddress || "unknown",
  userAgent: req.headers["user-agent"] || "unknown",
});

// Helper function to create activity log
const createActivityLog = async (req, activityType, description, metadata = {}) => {
  try {
    const admin = req.admin;
    const clientInfo = getClientInfo(req);
    
    await ActivityLog.create({
      userId: admin._id,
      userModel: "Admin",
      userEmail: admin.email,
      userName: admin.name,
      activityType,
      description,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      metadata,
    });
  } catch (error) {
    console.error("⚠️ Error creating activity log:", error);
    // Don't throw - activity logging failure shouldn't break the flow
  }
};

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6})$/;
const COLOR_PRESETS = ["default", "purple", "blue", "green", "rose", "custom"];

// Helper to initialize default settings
const getDefaultSettings = () => ({
  display: {
    theme: "light",
    uiDensity: "normal",
    defaultDashboardView: "records",
  },
  notifications: {
    newUserCreations: true,
    recordUpdates: true,
    criticalSystemAlerts: true,
    pdfGenerations: true,
    loginAttempts: false,
    soundEnabled: false,
  },
  privacy: {
    hideProfilePhoto: false,
    maskNameInNotifications: false,
  },
  // Admin defaults = blue palette
  colors: {
    bg: "#eff6ff",
    primary: "#2563eb",
    accent: "#60a5fa",
    preset: "blue",
  },
});

/**
 * PUT /api/admin/settings/display
 * Update display & interface settings
 */
export const updateDisplaySettings = async (req, res) => {
  try {
    const { theme, uiDensity, defaultDashboardView } = req.body;
    const admin = await Admin.findById(req.admin._id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Initialize settings if they don't exist
    if (!admin.settings) {
      admin.settings = getDefaultSettings();
    }
    if (!admin.settings.display) {
      admin.settings.display = getDefaultSettings().display;
    }

    const metadata = {};
    const oldSettings = { ...admin.settings.display };

    // Validate and update theme
    if (theme !== undefined) {
      if (!["light", "dark"].includes(theme)) {
        return res.status(400).json({
          success: false,
          message: "Invalid theme value. Must be 'light' or 'dark'.",
        });
      }
      if (admin.settings.display.theme !== theme) {
        admin.settings.display.theme = theme;
        metadata.theme = { old: oldSettings.theme, new: theme };
      }
    }

    // Validate and update UI density
    if (uiDensity !== undefined) {
      if (!["compact", "normal"].includes(uiDensity)) {
        return res.status(400).json({
          success: false,
          message: "Invalid UI density. Must be 'compact' or 'normal'.",
        });
      }
      if (admin.settings.display.uiDensity !== uiDensity) {
        admin.settings.display.uiDensity = uiDensity;
        metadata.uiDensity = { old: oldSettings.uiDensity, new: uiDensity };
      }
    }

    // Validate and update default dashboard view
    if (defaultDashboardView !== undefined) {
      if (!["users", "records", "notifications", "analytics"].includes(defaultDashboardView)) {
        return res.status(400).json({
          success: false,
          message: "Invalid default dashboard view. Must be 'users', 'records', 'notifications', or 'analytics'.",
        });
      }
      if (admin.settings.display.defaultDashboardView !== defaultDashboardView) {
        admin.settings.display.defaultDashboardView = defaultDashboardView;
        metadata.defaultDashboardView = { old: oldSettings.defaultDashboardView, new: defaultDashboardView };
      }
    }

    // Mark settings as modified
    admin.markModified("settings");
    await admin.save();
    cacheInvalidate("settings:");

    // Create activity log if any changes were made
    if (Object.keys(metadata).length > 0) {
      await createActivityLog(req, "display_settings_updated", "Updated display & interface settings", metadata);
    }

    res.status(200).json({
      success: true,
      message: "Display settings updated successfully",
      settings: admin.settings.display,
    });
  } catch (error) {
    console.error("❌ Error updating display settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update display settings",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * PUT /api/admin/settings/notifications
 * Update notification settings
 */
export const updateNotificationSettings = async (req, res) => {
  try {
    const {
      newUserCreations,
      recordUpdates,
      criticalSystemAlerts,
      pdfGenerations,
      loginAttempts,
      soundEnabled,
    } = req.body;

    const admin = await Admin.findById(req.admin._id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Initialize settings if they don't exist
    if (!admin.settings) {
      admin.settings = getDefaultSettings();
    }
    if (!admin.settings.notifications) {
      admin.settings.notifications = getDefaultSettings().notifications;
    }

    const metadata = {};
    const oldSettings = { ...admin.settings.notifications };

    // Validate and update notification settings (all should be booleans)
    const notificationFields = {
      newUserCreations,
      recordUpdates,
      criticalSystemAlerts,
      pdfGenerations,
      loginAttempts,
      soundEnabled,
    };

    for (const [key, value] of Object.entries(notificationFields)) {
      if (value !== undefined) {
        if (typeof value !== "boolean") {
          return res.status(400).json({
            success: false,
            message: `Invalid value for ${key}. Must be a boolean.`,
          });
        }
        if (admin.settings.notifications[key] !== value) {
          admin.settings.notifications[key] = value;
          metadata[key] = { old: oldSettings[key], new: value };
        }
      }
    }

    // Mark settings as modified
    admin.markModified("settings");
    await admin.save();
    cacheInvalidate("settings:");

    // Create activity log if any changes were made
    if (Object.keys(metadata).length > 0) {
      await createActivityLog(req, "notification_settings_updated", "Updated notification settings", metadata);
    }

    res.status(200).json({
      success: true,
      message: "Notification settings updated successfully",
      settings: admin.settings.notifications,
    });
  } catch (error) {
    console.error("❌ Error updating notification settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update notification settings",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * PUT /api/admin/settings/privacy
 * Update privacy settings
 */
export const updatePrivacySettings = async (req, res) => {
  try {
    const { hideProfilePhoto, maskNameInNotifications } = req.body;

    const admin = await Admin.findById(req.admin._id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Initialize settings if they don't exist
    if (!admin.settings) {
      admin.settings = getDefaultSettings();
    }
    if (!admin.settings.privacy) {
      admin.settings.privacy = getDefaultSettings().privacy;
    }

    const metadata = {};
    const oldSettings = { ...admin.settings.privacy };

    // Validate and update privacy settings
    if (hideProfilePhoto !== undefined) {
      if (typeof hideProfilePhoto !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "Invalid value for hideProfilePhoto. Must be a boolean.",
        });
      }
      if (admin.settings.privacy.hideProfilePhoto !== hideProfilePhoto) {
        admin.settings.privacy.hideProfilePhoto = hideProfilePhoto;
        metadata.hideProfilePhoto = { old: oldSettings.hideProfilePhoto, new: hideProfilePhoto };
      }
    }

    if (maskNameInNotifications !== undefined) {
      if (typeof maskNameInNotifications !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "Invalid value for maskNameInNotifications. Must be a boolean.",
        });
      }
      if (admin.settings.privacy.maskNameInNotifications !== maskNameInNotifications) {
        admin.settings.privacy.maskNameInNotifications = maskNameInNotifications;
        metadata.maskNameInNotifications = { old: oldSettings.maskNameInNotifications, new: maskNameInNotifications };
      }
    }

    // Mark settings as modified
    admin.markModified("settings");
    await admin.save();
    cacheInvalidate("settings:");

    // Create activity log if any changes were made
    if (Object.keys(metadata).length > 0) {
      await createActivityLog(req, "privacy_settings_updated", "Updated privacy settings", metadata);
    }

    res.status(200).json({
      success: true,
      message: "Privacy settings updated successfully",
      settings: admin.settings.privacy,
    });
  } catch (error) {
    console.error("❌ Error updating privacy settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update privacy settings",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * PUT /api/admin/settings/colors
 * Update color customization (background / primary / accent + preset)
 */
export const updateColorSettings = async (req, res) => {
  try {
    const { bg, primary, accent, preset } = req.body || {};
    const admin = await Admin.findById(req.admin._id);

    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    if (!admin.settings) admin.settings = getDefaultSettings();
    if (!admin.settings.colors) admin.settings.colors = getDefaultSettings().colors;

    const errors = [];
    [
      ["bg", bg],
      ["primary", primary],
      ["accent", accent],
    ].forEach(([key, val]) => {
      if (val !== undefined) {
        if (typeof val !== "string" || !HEX_COLOR_REGEX.test(val)) {
          errors.push(`Invalid ${key} color. Must be a 6-digit hex color (e.g., #2563eb).`);
        }
      }
    });
    if (preset !== undefined && !COLOR_PRESETS.includes(preset)) {
      errors.push(`Invalid preset. Must be one of: ${COLOR_PRESETS.join(", ")}.`);
    }
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: "Validation errors", errors });
    }

    const oldColors = { ...admin.settings.colors };
    const metadata = {};

    if (bg !== undefined && admin.settings.colors.bg !== bg) {
      admin.settings.colors.bg = bg;
      metadata.bg = { old: oldColors.bg, new: bg };
    }
    if (primary !== undefined && admin.settings.colors.primary !== primary) {
      admin.settings.colors.primary = primary;
      metadata.primary = { old: oldColors.primary, new: primary };
    }
    if (accent !== undefined && admin.settings.colors.accent !== accent) {
      admin.settings.colors.accent = accent;
      metadata.accent = { old: oldColors.accent, new: accent };
    }
    if (preset !== undefined && admin.settings.colors.preset !== preset) {
      admin.settings.colors.preset = preset;
      metadata.preset = { old: oldColors.preset, new: preset };
    }

    admin.markModified("settings");
    await admin.save();
    cacheInvalidate("settings:");

    if (Object.keys(metadata).length > 0) {
      await createActivityLog(req, "color_settings_updated", "Updated theme color customization", metadata);
    }

    res.status(200).json({
      success: true,
      message: "Color settings updated successfully",
      settings: admin.settings.colors,
    });
  } catch (error) {
    console.error("❌ Error updating admin color settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update color settings",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * POST /api/admin/settings/colors/reset
 * Reset colors to admin defaults (blue palette).
 */
export const resetColorSettings = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id);
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }
    if (!admin.settings) admin.settings = getDefaultSettings();
    admin.settings.colors = getDefaultSettings().colors;
    admin.markModified("settings");
    await admin.save();
    cacheInvalidate("settings:");

    await createActivityLog(req, "color_settings_reset", "Reset theme color customization to defaults");

    res.status(200).json({
      success: true,
      message: "Color settings reset to defaults",
      settings: admin.settings.colors,
    });
  } catch (error) {
    console.error("❌ Error resetting admin color settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset color settings",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * GET /api/admin/settings
 * Get all admin settings
 */
export const getSettings = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select("settings");

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Return settings or defaults if not set
    const settings = admin.settings || getDefaultSettings();

    res.status(200).json({
      success: true,
      settings: {
        display: settings.display || getDefaultSettings().display,
        notifications: settings.notifications || getDefaultSettings().notifications,
        privacy: settings.privacy || getDefaultSettings().privacy,
        colors: settings.colors || getDefaultSettings().colors,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching admin settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch settings",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


