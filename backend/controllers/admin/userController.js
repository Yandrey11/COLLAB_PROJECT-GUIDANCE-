import Counselor from "../../models/Counselor.js";
import Session from "../../models/Session.js";

// Get all users with online/offline status
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", role = "all", status = "all" } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query for users
    const userQuery = {};
    
    if (search) {
      userQuery.$or = [
        { email: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
      ];
    }

    if (role !== "all") {
      userQuery.role = role;
    }

    // Get all users with pagination
    const users = await Counselor.find(userQuery)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const total = await Counselor.countDocuments(userQuery);

    // Get all active session user IDs
    const activeSessions = await Session.find({ isActive: true }).select("userId").lean();
    const activeUserIds = new Set(activeSessions.map(s => s.userId?.toString() || s.userId));

    // Get session details for users who are online
    const sessionMap = new Map();
    for (const session of activeSessions) {
      const userId = session.userId?.toString() || session.userId;
      if (userId && !sessionMap.has(userId)) {
        sessionMap.set(userId, session);
      }
    }

    // Format response with online/offline status
    const formattedUsers = users.map((user) => {
      const userId = user._id.toString();
      const isOnline = activeUserIds.has(userId);
      const session = sessionMap.get(userId);

      return {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || "counselor",
        createdAt: user.createdAt,
        isOnline,
        loginTime: session?.loginTime || null,
        lastActivity: session?.lastActivity || null,
        sessionId: session?._id || null,
      };
    });

    // Filter by online/offline status if specified
    let filteredUsers = formattedUsers;
    if (status === "online") {
      filteredUsers = formattedUsers.filter(u => u.isOnline);
    } else if (status === "offline") {
      filteredUsers = formattedUsers.filter(u => !u.isOnline);
    }

    res.status(200).json({
      users: filteredUsers,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      total,
      onlineCount: formattedUsers.filter(u => u.isOnline).length,
      offlineCount: formattedUsers.filter(u => !u.isOnline).length,
    });
  } catch (error) {
    console.error("❌ Error fetching users:", error);
    res.status(500).json({ message: "Error fetching users" });
  }
};

