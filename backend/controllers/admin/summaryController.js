import Counselor from "../../models/Counselor.js";
import GoogleUser from "../../models/GoogleUser.js";
import Admin from "../../models/Admin.js";
import Session from "../../models/Session.js";
import Notification from "../../models/Notification.js";

// Get admin dashboard summary
export const getSummary = async (req, res) => {
  try {
    // Count all users from all collections
    const totalRegularUsers = await Counselor.countDocuments();
    const totalGoogleUsers = await GoogleUser.countDocuments();
    const totalAdmins = await Admin.countDocuments();
    const totalUsers = totalRegularUsers + totalGoogleUsers + totalAdmins;

    // Count counselors (from User collection with role "counselor")
    const totalCounselors = await Counselor.countDocuments({ role: "counselor" });

    // Count admins (from Admin collection + User collection with role "admin")
    const adminsInUserCollection = await Counselor.countDocuments({ role: "admin" });
    const totalAdminAccounts = totalAdmins + adminsInUserCollection;

    // Get active sessions to determine online/offline counts
    const activeSessions = await Session.find({ isActive: true }).select("userId email").lean();
    const onlineUserIds = new Set(activeSessions.map(s => s.userId?.toString()));
    const onlineUserEmails = new Set(activeSessions.map(s => s.email?.toLowerCase()));

    // Count active users (users with active sessions)
    // We need to check all collections
    const allRegularUsers = await Counselor.find().select("_id email").lean();
    const allGoogleUsers = await GoogleUser.find().select("_id email").lean();
    const allAdmins = await Admin.find().select("_id email").lean();

    let activeCount = 0;
    let inactiveCount = 0;

    // Check regular users
    allRegularUsers.forEach(user => {
      const userId = user._id.toString();
      const userEmail = user.email?.toLowerCase();
      const isOnline = onlineUserIds.has(userId) || (userEmail && onlineUserEmails.has(userEmail));
      if (isOnline) activeCount++;
      else inactiveCount++;
    });

    // Check Google users
    allGoogleUsers.forEach(user => {
      const userEmail = user.email?.toLowerCase();
      const isOnline = userEmail && onlineUserEmails.has(userEmail);
      if (isOnline) activeCount++;
      else inactiveCount++;
    });

    // Check admins
    allAdmins.forEach(admin => {
      const adminId = admin._id.toString();
      const adminEmail = admin.email?.toLowerCase();
      const isOnline = onlineUserIds.has(adminId) || (adminEmail && onlineUserEmails.has(adminEmail));
      if (isOnline) activeCount++;
      else inactiveCount++;
    });

    // Get recent activities from notifications (last 10 activities)
    const recentNotifications = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Format notifications as recent activities
    const recentActivity = recentNotifications.map(notif => {
      const timeAgo = getTimeAgo(notif.createdAt);
      return {
        id: notif._id.toString(),
        title: notif.title,
        description: notif.description,
        category: notif.category,
        priority: notif.priority,
        time: timeAgo,
        timestamp: notif.createdAt,
        status: notif.status,
      };
    });

    res.status(200).json({
      totalUsers,
      totalAdmins: totalAdminAccounts,
      totalCounselors,
      active: activeCount,
      inactive: inactiveCount,
      recentActivity,
    });
  } catch (error) {
    console.error("❌ Error fetching summary:", error);
    res.status(500).json({ 
      message: "Error fetching summary",
      totalUsers: 0,
      totalAdmins: 0,
      totalCounselors: 0,
      active: 0,
      inactive: 0,
      recentActivity: [],
    });
  }
};

// Helper function to format time ago
function getTimeAgo(date) {
  if (!date) return "Unknown";
  
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now - past) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds} second${diffInSeconds !== 1 ? "s" : ""} ago`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? "s" : ""} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? "s" : ""} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays !== 1 ? "s" : ""} ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} week${diffInWeeks !== 1 ? "s" : ""} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths} month${diffInMonths !== 1 ? "s" : ""} ago`;
}

