import CounselorSettings from "../models/CounselorSettings.js";
import { cacheInvalidate } from "../utils/cache.js";

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6})$/;
const COLOR_PRESETS = ["default", "purple", "blue", "green", "rose", "custom"];

const COUNSELOR_DEFAULT_COLORS = {
  bg: "#f5f3ff",
  primary: "#7c3aed",
  accent: "#a78bfa",
  preset: "purple",
};

function validateColorsPayload(colors, errors) {
  if (!colors || typeof colors !== "object") return;
  ["bg", "primary", "accent"].forEach((key) => {
    if (colors[key] !== undefined) {
      if (typeof colors[key] !== "string" || !HEX_COLOR_REGEX.test(colors[key])) {
        errors.push(`Invalid ${key} color. Must be a 6-digit hex color (e.g., #7c3aed).`);
      }
    }
  });
  if (colors.preset !== undefined && !COLOR_PRESETS.includes(colors.preset)) {
    errors.push(`Invalid preset. Must be one of: ${COLOR_PRESETS.join(", ")}.`);
  }
}

/**
 * @desc    Get counselor settings
 * @route   GET /api/counselor/settings
 * @access  Private (Counselor only)
 */
export const getSettings = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== "counselor") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only counselors can access settings.",
      });
    }

    // Determine user model type
    const userModel = user.googleId ? "GoogleUser" : "Counselor";
    const userId = user._id;

    // Get or create settings
    const settings = await CounselorSettings.getOrCreateSettings(
      userId,
      userModel,
      user.email
    );

    res.status(200).json({
      success: true,
      settings: {
        display: settings.display,
        notifications: settings.notifications,
        googleCalendar: settings.googleCalendar,
        privacy: settings.privacy,
        colors: settings.colors || COUNSELOR_DEFAULT_COLORS,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching counselor settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch settings",
      error: error.message,
    });
  }
};

/**
 * @desc    Update counselor settings
 * @route   PUT /api/counselor/settings
 * @access  Private (Counselor only)
 */
export const updateSettings = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== "counselor") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only counselors can update settings.",
      });
    }

    // Determine user model type
    const userModel = user.googleId ? "GoogleUser" : "Counselor";
    const userId = user._id;

    const { display, notifications, googleCalendar, privacy, colors } = req.body;

    // Validation
    const errors = [];

    // Validate colors
    validateColorsPayload(colors, errors);

    // Validate display settings
    if (display) {
      if (display.theme && !["light", "dark"].includes(display.theme)) {
        errors.push("Invalid theme value. Must be 'light' or 'dark'.");
      }
      if (display.uiDensity && !["compact", "normal"].includes(display.uiDensity)) {
        errors.push("Invalid UI density. Must be 'compact' or 'normal'.");
      }
      if (
        display.defaultDashboardView &&
        !["calendar", "records", "notifications"].includes(display.defaultDashboardView)
      ) {
        errors.push("Invalid default dashboard view. Must be 'calendar', 'records', or 'notifications'.");
      }
    }

    // Validate notification settings (should be booleans)
    if (notifications) {
      const notificationKeys = ["recordUpdates", "adminAnnouncements", "googleCalendarSync", "soundEnabled"];
      for (const key of notificationKeys) {
        if (notifications[key] !== undefined && typeof notifications[key] !== "boolean") {
          errors.push(`Invalid value for ${key}. Must be a boolean.`);
        }
      }
    }

    // Validate Google Calendar settings
    if (googleCalendar) {
      if (
        googleCalendar.showOnDashboard !== undefined &&
        typeof googleCalendar.showOnDashboard !== "boolean"
      ) {
        errors.push("Invalid value for showOnDashboard. Must be a boolean.");
      }
      if (
        googleCalendar.preferredView &&
        !["day", "week", "month"].includes(googleCalendar.preferredView)
      ) {
        errors.push("Invalid preferred view. Must be 'day', 'week', or 'month'.");
      }
    }

    // Validate privacy settings (should be booleans)
    if (privacy) {
      const privacyKeys = ["hideProfilePhoto", "maskNameInPDFs"];
      for (const key of privacyKeys) {
        if (privacy[key] !== undefined && typeof privacy[key] !== "boolean") {
          errors.push(`Invalid value for ${key}. Must be a boolean.`);
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors,
      });
    }

    // Get or create settings
    let settings = await CounselorSettings.findOne({ userId, userModel });

    if (!settings) {
      settings = await CounselorSettings.create({
        userId,
        userModel,
        userEmail: user.email,
      });
    }

    // Update only provided fields
    if (display) {
      settings.display = { ...settings.display, ...display };
    }
    if (notifications) {
      settings.notifications = { ...settings.notifications, ...notifications };
    }
    if (googleCalendar) {
      settings.googleCalendar = { ...settings.googleCalendar, ...googleCalendar };
    }
    if (privacy) {
      settings.privacy = { ...settings.privacy, ...privacy };
    }
    if (colors) {
      const currentColors = settings.colors || COUNSELOR_DEFAULT_COLORS;
      settings.colors = {
        bg: colors.bg ?? currentColors.bg,
        primary: colors.primary ?? currentColors.primary,
        accent: colors.accent ?? currentColors.accent,
        preset: colors.preset ?? currentColors.preset,
      };
      settings.markModified("colors");
    }

    await settings.save();
    cacheInvalidate("settings:");

    res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      settings: {
        display: settings.display,
        notifications: settings.notifications,
        googleCalendar: settings.googleCalendar,
        privacy: settings.privacy,
        colors: settings.colors || COUNSELOR_DEFAULT_COLORS,
      },
    });
  } catch (error) {
    console.error("❌ Error updating counselor settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update settings",
      error: error.message,
    });
  }
};

/**
 * @desc    Reset settings to defaults
 * @route   POST /api/counselor/settings/reset
 * @access  Private (Counselor only)
 */
export const resetSettings = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== "counselor") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only counselors can reset settings.",
      });
    }

    const userModel = user.googleId ? "GoogleUser" : "Counselor";
    const userId = user._id;

    let settings = await CounselorSettings.findOne({ userId, userModel });

    if (!settings) {
      settings = await CounselorSettings.create({
        userId,
        userModel,
        userEmail: user.email,
      });
    }

    // Reset to defaults
    settings.display = {
      theme: "light",
      uiDensity: "normal",
      defaultDashboardView: "calendar",
    };
    settings.notifications = {
      recordUpdates: true,
      adminAnnouncements: true,
      googleCalendarSync: true,
      soundEnabled: false,
    };
    settings.googleCalendar = {
      showOnDashboard: true,
      preferredView: "month",
    };
    settings.privacy = {
      hideProfilePhoto: false,
      maskNameInPDFs: false,
    };
    settings.colors = { ...COUNSELOR_DEFAULT_COLORS };
    settings.markModified("colors");

    await settings.save();
    cacheInvalidate("settings:");

    res.status(200).json({
      success: true,
      message: "Settings reset to defaults",
      settings: {
        display: settings.display,
        notifications: settings.notifications,
        googleCalendar: settings.googleCalendar,
        privacy: settings.privacy,
        colors: settings.colors,
      },
    });
  } catch (error) {
    console.error("❌ Error resetting counselor settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset settings",
      error: error.message,
    });
  }
};

