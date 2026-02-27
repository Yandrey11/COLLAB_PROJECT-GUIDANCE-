import AnalyticsEvent from "../../models/AnalyticsEvent.js";
import DailySummaryReport from "../../models/DailySummaryReport.js";
import Record from "../../models/Record.js";
import Counselor from "../../models/Counselor.js";
import Admin from "../../models/Admin.js";
import GoogleUser from "../../models/GoogleUser.js";
import Notification from "../../models/Notification.js";
import ActivityLog from "../../models/ActivityLog.js";
import Session from "../../models/Session.js";

/**
 * Get analytics overview (summary cards data)
 */
export const getAnalyticsOverview = async (req, res) => {
  try {
    const { range = "30d" } = req.query; // default to last 30 days

    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    
    switch (range) {
      case "7d":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(now.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(now.getDate() - 90);
        break;
      case "1y":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Total counseling records (always accurate - counts all records)
    const totalRecords = await Record.countDocuments();

    // Records created in date range - try analytics events first, fallback to actual records
    let recordsCreated = await AnalyticsEvent.countDocuments({
      eventType: "record_created",
      date: { $gte: startDate },
    });
    
    // Fallback: If no analytics events, count actual records created in date range
    // Check both createdAt (from timestamps) and date field
    if (recordsCreated === 0) {
      recordsCreated = await Record.countDocuments({
        $or: [
          { createdAt: { $gte: startDate } },
          { date: { $gte: startDate } }
        ]
      });
    }

    // Total PDFs generated - try analytics events first, fallback to records with driveLink
    let totalPDFs = await AnalyticsEvent.countDocuments({
      eventType: "pdf_generated",
      date: { $gte: startDate },
    });
    
    // Fallback: Count records with driveLink (PDFs are uploaded to Drive)
    if (totalPDFs === 0) {
      totalPDFs = await Record.countDocuments({
        driveLink: { $exists: true, $ne: null, $ne: "" },
        createdAt: { $gte: startDate },
      });
    }

    // Total Google Drive uploads - try analytics events first, fallback to records with driveLink
    let totalDriveUploads = await AnalyticsEvent.countDocuments({
      eventType: "drive_uploaded",
      date: { $gte: startDate },
    });
    
    // Fallback: Count records with driveLink
    if (totalDriveUploads === 0) {
      totalDriveUploads = await Record.countDocuments({
        driveLink: { $exists: true, $ne: null, $ne: "" },
        createdAt: { $gte: startDate },
      });
    }

    // Active counselors - count only counselors who are CURRENTLY logged in (have active sessions NOW)
    const Session = (await import("../../models/Session.js")).default;
    
    // Get unique counselors who have active sessions RIGHT NOW (not filtered by date)
    // Count distinct counselor emails with active sessions
    const activeCounselorsCount = await Session.distinct("email", {
      isActive: true,
      role: "counselor",
    });
    
    const activeCounselorsThisWeekCount = activeCounselorsCount.length;

    // Total page visits
    const totalPageVisits = await AnalyticsEvent.countDocuments({
      eventType: "page_visit",
      date: { $gte: startDate },
    });

    // Get active users count
    const activeUsers = await AnalyticsEvent.distinct("userId", {
      date: { $gte: startDate },
    });

    res.status(200).json({
      success: true,
      overview: {
        totalRecords,
        recordsCreatedInRange: recordsCreated,
        totalPDFsGenerated: totalPDFs,
        totalDriveUploads,
        activeCounselorsThisWeek: activeCounselorsThisWeekCount,
        totalPageVisits,
        activeUsers: activeUsers.length,
      },
      dateRange: {
        start: startDate,
        end: now,
        range,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching analytics overview:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch analytics overview",
      error: error.message,
    });
  }
};

/**
 * Get page visits analytics
 */
export const getPageVisits = async (req, res) => {
  try {
    const { range = "30d", pageName = null } = req.query;

    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    
    switch (range) {
      case "7d":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(now.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(now.getDate() - 90);
        break;
      case "1y":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    const query = {
      eventType: "page_visit",
      date: { $gte: startDate, $lte: now },
    };

    if (pageName) {
      query.pageName = pageName;
    }

    // Get page visits grouped by page name
    const pageVisitsByPage = await AnalyticsEvent.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$pageName",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Get daily page visits for line chart
    const dailyPageVisits = await AnalyticsEvent.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: "$year",
            month: "$month",
            day: "$day",
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
          "_id.day": 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      pageVisits: {
        byPage: pageVisitsByPage.map((item) => ({
          pageName: item._id || "Unknown",
          count: item.count,
        })),
        daily: dailyPageVisits.map((item) => ({
          date: `${item._id.year}-${String(item._id.month).padStart(2, "0")}-${String(item._id.day).padStart(2, "0")}`,
          count: item.count,
        })),
      },
      dateRange: {
        start: startDate,
        end: now,
        range,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching page visits:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch page visits",
      error: error.message,
    });
  }
};

/**
 * Get events analytics - combines multiple data sources
 */
export const getEvents = async (req, res) => {
  try {
    const { range = "30d", eventType = null, userId = null, pageName = null } = req.query;

    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    
    switch (range) {
      case "7d":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(now.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(now.getDate() - 90);
        break;
      case "1y":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    const limit = parseInt(req.query.limit) || 50;
    const allEvents = [];

    // 1. Get Analytics Events
    const analyticsQuery = {
      createdAt: { $gte: startDate, $lte: now },
    };
    if (eventType) analyticsQuery.eventType = eventType;
    if (userId) analyticsQuery.userId = userId;
    if (pageName) analyticsQuery.pageName = pageName;

    const analyticsEvents = await AnalyticsEvent.find(analyticsQuery)
      .sort({ createdAt: -1 })
      .limit(limit * 2) // Get more for filtering
      .lean();

    analyticsEvents.forEach(event => {
      allEvents.push({
        id: event._id.toString(),
        eventType: event.eventType || "unknown",
        userName: event.userName || "Unknown",
        userEmail: event.userEmail || "N/A",
        userRole: event.userRole || "N/A",
        pageName: event.pageName || "N/A",
        metadata: event.metadata || {},
        timestamp: event.createdAt || event.date || new Date(),
        source: "analytics",
      });
    });

    // 2. Get Record Activities (from audit trails)
    const recordsQuery = {
      "auditTrail.createdAt": { $gte: startDate, $lte: now },
    };
    if (userId) recordsQuery["auditTrail.createdBy.userId"] = userId;

    const recentRecords = await Record.find(recordsQuery)
      .sort({ "auditTrail.createdAt": -1 })
      .limit(limit)
      .lean();

    recentRecords.forEach(record => {
      if (record.auditTrail?.createdBy) {
        allEvents.push({
          id: `record_${record._id.toString()}`,
          eventType: "record_created",
          userName: record.auditTrail.createdBy.userName || record.counselor || "Unknown",
          userEmail: record.auditTrail.createdBy.userEmail || "N/A",
          userRole: record.auditTrail.createdBy.userRole || "counselor",
          pageName: "Records Page",
          metadata: {
            clientName: record.clientName,
            recordId: record._id.toString(),
            sessionNumber: record.sessionNumber,
          },
          timestamp: record.auditTrail.createdAt || record.createdAt || new Date(),
          source: "record",
        });
      }

      // Record updates
      if (record.auditTrail?.modificationHistory && record.auditTrail.modificationHistory.length > 0) {
        const lastModification = record.auditTrail.modificationHistory[record.auditTrail.modificationHistory.length - 1];
        if (lastModification.changedAt >= startDate) {
          allEvents.push({
            id: `record_update_${record._id.toString()}_${lastModification.changedAt.getTime()}`,
            eventType: "record_updated",
            userName: lastModification.changedBy?.userName || record.counselor || "Unknown",
            userEmail: lastModification.changedBy?.userEmail || "N/A",
            userRole: lastModification.changedBy?.userRole || "counselor",
            pageName: "Records Page",
            metadata: {
              clientName: record.clientName,
              recordId: record._id.toString(),
              fieldChanged: lastModification.field,
            },
            timestamp: lastModification.changedAt || new Date(),
            source: "record",
          });
        }
      }
    });

    // 3. Get Notifications (system/user activities)
    const notificationsQuery = {
      createdAt: { $gte: startDate, $lte: now },
    };
    if (eventType && eventType.includes("notification")) {
      // Filter by notification category
    }

    const notifications = await Notification.find(notificationsQuery)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    notifications.forEach(notif => {
      const userName = notif.metadata?.createdBy || notif.metadata?.generatedBy || "System";
      const userRole = notif.metadata?.createdByRole || notif.metadata?.generatedByRole || "system";
      
      allEvents.push({
        id: `notification_${notif._id.toString()}`,
        eventType: notif.category === "User Activity" ? "notification_sent" : "system_event",
        userName: userName,
        userEmail: notif.metadata?.email || "N/A",
        userRole: userRole,
        pageName: "Notification Center",
        metadata: {
          title: notif.title,
          description: notif.description,
          category: notif.category,
          priority: notif.priority,
        },
        timestamp: notif.createdAt || new Date(),
        source: "notification",
      });
    });

    // 4. Get Activity Logs (login, profile updates, etc.)
    const activityQuery = {
      createdAt: { $gte: startDate, $lte: now },
    };
    if (userId) activityQuery.userId = userId;

    const activityLogs = await ActivityLog.find(activityQuery)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    activityLogs.forEach(log => {
      let eventType = "user_activity";
      let pageName = "Settings";
      
      if (log.activityType === "login") {
        eventType = "user_login";
        pageName = "Dashboard";
      } else if (log.activityType === "logout") {
        eventType = "user_logout";
        pageName = "Dashboard";
      } else if (log.activityType.includes("profile")) {
        eventType = "profile_updated";
        pageName = "Profile";
      }

      allEvents.push({
        id: `activity_${log._id.toString()}`,
        eventType: eventType,
        userName: log.userName || "Unknown",
        userEmail: log.userEmail || "N/A",
        userRole: log.userModel?.toLowerCase() === "admin" ? "admin" : "counselor",
        pageName: pageName,
        metadata: {
          activityType: log.activityType,
          description: log.description,
        },
        timestamp: log.createdAt || new Date(),
        source: "activity_log",
      });
    });

    // 5. Get Recent Sessions (logins) - only get unique logins per user
    const sessionQuery = {
      createdAt: { $gte: startDate, $lte: now },
    };
    if (userId) sessionQuery.userId = userId;

    // Get unique sessions by userId to avoid duplicates
    const recentSessions = await Session.aggregate([
      { $match: sessionQuery },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$userId",
          latestSession: { $first: "$$ROOT" },
        },
      },
      { $limit: limit },
    ]);

    recentSessions.forEach(item => {
      const session = item.latestSession;
      allEvents.push({
        id: `session_${session._id.toString()}`,
        eventType: "user_login",
        userName: session.name || "Unknown",
        userEmail: session.email || "N/A",
        userRole: session.role || "counselor",
        pageName: "Dashboard",
        metadata: {
          ipAddress: session.ipAddress,
        },
        timestamp: session.loginTime || session.createdAt || new Date(),
        source: "session",
      });
    });

    // Sort all events by timestamp (most recent first)
    allEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply filters
    let filteredEvents = allEvents;
    if (eventType && eventType !== "") {
      filteredEvents = filteredEvents.filter(e => e.eventType === eventType);
    }
    if (pageName && pageName !== "") {
      filteredEvents = filteredEvents.filter(e => e.pageName === pageName);
    }

    // Apply pagination
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;
    const paginatedEvents = filteredEvents.slice(skip, skip + limit);
    const total = filteredEvents.length;

    res.status(200).json({
      success: true,
      events: paginatedEvents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      dateRange: {
        start: startDate,
        end: now,
        range,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching events:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch events",
      error: error.message,
    });
  }
};

/**
 * Get record status distribution
 */
export const getRecordStatusDistribution = async (req, res) => {
  try {
    const statusDistribution = await Record.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const total = statusDistribution.reduce((sum, item) => sum + item.count, 0);

    res.status(200).json({
      success: true,
      distribution: statusDistribution.map((item) => ({
        status: item._id || "Unknown",
        count: item.count,
        percentage: total > 0 ? ((item.count / total) * 100).toFixed(2) : 0,
      })),
      total,
    });
  } catch (error) {
    console.error("❌ Error fetching record status distribution:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch record status distribution",
      error: error.message,
    });
  }
};

/**
 * Get daily records created (for line chart)
 */
export const getDailyRecordsCreated = async (req, res) => {
  try {
    const { range = "30d" } = req.query;

    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    
    switch (range) {
      case "7d":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(now.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(now.getDate() - 90);
        break;
      case "1y":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Try to get from analytics events first
    let dailyRecords = await AnalyticsEvent.aggregate([
      {
        $match: {
          eventType: "record_created",
          date: { $gte: startDate, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            year: "$year",
            month: "$month",
            day: "$day",
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
          "_id.day": 1,
        },
      },
    ]);

    // If no analytics events or very few, fallback to actual records
    if (dailyRecords.length === 0) {
      // Get records from actual Record collection
      // Check all possible date fields: createdAt, date, auditTrail.createdAt
      const recordsFromDB = await Record.aggregate([
        {
          $match: {
            $or: [
              { createdAt: { $gte: startDate, $lte: now } },
              { date: { $gte: startDate, $lte: now } },
              { "auditTrail.createdAt": { $gte: startDate, $lte: now } },
            ],
          },
        },
        {
          $project: {
            recordDate: {
              $ifNull: [
                "$auditTrail.createdAt",
                { $ifNull: ["$createdAt", "$date"] },
              ],
            },
          },
        },
        {
          $match: {
            recordDate: { $gte: startDate, $lte: now },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$recordDate" },
              month: { $month: "$recordDate" },
              day: { $dayOfMonth: "$recordDate" },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: {
            "_id.year": 1,
            "_id.month": 1,
            "_id.day": 1,
          },
        },
      ]);

      dailyRecords = recordsFromDB;
    }

    // Format the data for the chart
    const formattedRecords = dailyRecords.map((item) => {
      const year = item._id.year;
      const month = String(item._id.month).padStart(2, "0");
      const day = String(item._id.day).padStart(2, "0");
      return {
        date: `${year}-${month}-${day}`,
        count: item.count,
      };
    });

    // Fill in missing dates with 0 counts for better visualization
    const allDates = [];
    const currentDate = new Date(startDate);
    while (currentDate <= now) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;
      const existingRecord = formattedRecords.find((r) => r.date === dateStr);
      allDates.push(
        existingRecord || {
          date: dateStr,
          count: 0,
        }
      );
      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.status(200).json({
      success: true,
      dailyRecords: allDates,
      dateRange: {
        start: startDate,
        end: now,
        range,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching daily records:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch daily records",
      error: error.message,
    });
  }
};

/**
 * Log an analytics event (public endpoint used by system)
 */
export const logEvent = async (req, res) => {
  try {
    const { eventType, pageName, metadata = {} } = req.body;
    const user = req.user || req.admin || null;

    if (!eventType) {
      return res.status(400).json({
        success: false,
        message: "eventType is required",
      });
    }

    // Use the analytics logger utility
    const { logAnalyticsEvent } = await import("../../utils/analyticsLogger.js");
    
    await logAnalyticsEvent({
      eventType,
      user,
      pageName,
      metadata,
      ipAddress: req.ip || req.connection?.remoteAddress || req.headers["x-forwarded-for"]?.split(",")[0],
      userAgent: req.headers["user-agent"],
    });

    res.status(200).json({
      success: true,
      message: "Event logged successfully",
    });
  } catch (error) {
    console.error("❌ Error logging event:", error);
    res.status(500).json({
      success: false,
      message: "Failed to log event",
      error: error.message,
    });
  }
};

