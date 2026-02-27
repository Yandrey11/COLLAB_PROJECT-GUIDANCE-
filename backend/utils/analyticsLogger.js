import AnalyticsEvent from "../models/AnalyticsEvent.js";

/**
 * Log an analytics event
 * @param {Object} eventData - Event data object
 * @param {string} eventData.eventType - Type of event (must be in enum)
 * @param {Object} eventData.user - User object (optional)
 * @param {string} eventData.pageName - Page name (for page visits)
 * @param {Object} eventData.metadata - Additional metadata
 * @param {string} eventData.ipAddress - IP address
 * @param {string} eventData.userAgent - User agent string
 */
export const logAnalyticsEvent = async (eventData) => {
  try {
    const {
      eventType,
      user = null,
      pageName = null,
      metadata = {},
      ipAddress = null,
      userAgent = null,
    } = eventData;

    if (!eventType) {
      console.error("❌ Analytics: eventType is required");
      return;
    }

    // Extract user information
    let userId = null;
    let userModel = null;
    let userName = null;
    let userEmail = null;
    let userRole = null;

    if (user) {
      userId = user._id || user.id;
      userModel = user.constructor?.modelName || "Counselor";
      userName = user.name || user.userName || "Unknown";
      userEmail = user.email || user.userEmail || null;
      userRole = user.role || (user.permissions?.is_admin ? "admin" : "counselor");
    }

    // Create analytics event
    const analyticsEvent = new AnalyticsEvent({
      eventType,
      userId,
      userModel,
      userName,
      userEmail,
      userRole,
      pageName,
      metadata,
      ipAddress,
      userAgent,
      date: new Date(),
    });

    // Save asynchronously (don't await to avoid blocking)
    analyticsEvent.save().catch((error) => {
      console.error("❌ Error saving analytics event:", error);
    });
  } catch (error) {
    console.error("❌ Error in logAnalyticsEvent:", error);
  }
};

/**
 * Log a page visit
 */
export const logPageVisit = async (req, pageName) => {
  const user = req.user || req.admin || null;
  await logAnalyticsEvent({
    eventType: "page_visit",
    user,
    pageName,
    ipAddress: req.ip || req.connection?.remoteAddress || req.headers["x-forwarded-for"]?.split(",")[0],
    userAgent: req.headers["user-agent"],
    metadata: {
      path: req.path,
      method: req.method,
    },
  });
};

/**
 * Log record created event
 */
export const logRecordCreated = async (user, recordId, metadata = {}) => {
  await logAnalyticsEvent({
    eventType: "record_created",
    user,
    metadata: {
      recordId: recordId?.toString(),
      ...metadata,
    },
  });
};

/**
 * Log record updated event
 */
export const logRecordUpdated = async (user, recordId, metadata = {}) => {
  await logAnalyticsEvent({
    eventType: "record_updated",
    user,
    metadata: {
      recordId: recordId?.toString(),
      ...metadata,
    },
  });
};

/**
 * Log record locked/unlocked event
 */
export const logRecordLocked = async (user, recordId, action = "locked") => {
  await logAnalyticsEvent({
    eventType: action === "locked" ? "record_locked" : "record_unlocked",
    user,
    metadata: {
      recordId: recordId?.toString(),
      action,
    },
  });
};

/**
 * Log PDF generated event
 */
export const logPDFGenerated = async (user, metadata = {}) => {
  await logAnalyticsEvent({
    eventType: "pdf_generated",
    user,
    metadata,
  });
};

/**
 * Log Google Drive upload event
 */
export const logDriveUpload = async (user, metadata = {}) => {
  await logAnalyticsEvent({
    eventType: "drive_uploaded",
    user,
    metadata,
  });
};

/**
 * Log login event
 */
export const logLogin = async (req, user) => {
  await logAnalyticsEvent({
    eventType: "user_login",
    user,
    ipAddress: req.ip || req.connection?.remoteAddress || req.headers["x-forwarded-for"]?.split(",")[0],
    userAgent: req.headers["user-agent"],
  });
};

/**
 * Log logout event
 */
export const logLogout = async (req, user) => {
  await logAnalyticsEvent({
    eventType: "user_logout",
    user,
    ipAddress: req.ip || req.connection?.remoteAddress || req.headers["x-forwarded-for"]?.split(",")[0],
    userAgent: req.headers["user-agent"],
  });
};

/**
 * Log report generated event
 */
export const logReportGenerated = async (user, metadata = {}) => {
  await logAnalyticsEvent({
    eventType: "report_generated",
    user,
    metadata,
  });
};

