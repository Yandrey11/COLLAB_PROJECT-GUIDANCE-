import Session from "../../models/Session.js";
import SessionSettings from "../../models/SessionSettings.js";
import jwt from "jsonwebtoken";

// Get all active sessions
export const getActiveSessions = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", role = "all" } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = { isActive: true };
    
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
      ];
    }

    if (role !== "all") {
      query.role = role;
    }

    // Get sessions with pagination
    const sessions = await Session.find(query)
      .sort({ loginTime: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("userId", "name email role")
      .lean();

    // Get total count
    const total = await Session.countDocuments(query);

    // Format response
    const formattedSessions = sessions.map((session) => ({
      id: session._id,
      userId: session.userId?._id || session.userId,
      email: session.email,
      name: session.name,
      role: session.role,
      loginTime: session.loginTime,
      lastActivity: session.lastActivity,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      token: session.token, // Include for force logout
    }));

    res.status(200).json({
      sessions: formattedSessions,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    console.error("❌ Error fetching active sessions:", error);
    res.status(500).json({ message: "Error fetching active sessions" });
  }
};

// Force logout a user session
export const forceLogout = async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Find and deactivate the session
    const session = await Session.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }

    if (!session.isActive) {
      return res.status(400).json({ message: "Session is already inactive" });
    }

    // Deactivate session
    session.isActive = false;
    await session.save();

    res.status(200).json({
      message: "User session terminated successfully",
      sessionId: session._id,
      email: session.email,
    });
  } catch (error) {
    console.error("❌ Error forcing logout:", error);
    res.status(500).json({ message: "Error terminating session" });
  }
};

// Get session timeout settings
export const getSessionSettings = async (req, res) => {
  try {
    const settings = await SessionSettings.getSettings();
    res.status(200).json({
      inactivityTimeout: settings.inactivityTimeout,
      maxSessionDuration: settings.maxSessionDuration,
      lastUpdatedAt: settings.lastUpdatedAt,
    });
  } catch (error) {
    console.error("❌ Error fetching session settings:", error);
    res.status(500).json({ message: "Error fetching session settings" });
  }
};

// Update session timeout settings
export const updateSessionSettings = async (req, res) => {
  try {
    const { inactivityTimeout, maxSessionDuration } = req.body;

    // Validate inputs
    if (inactivityTimeout !== undefined) {
      if (inactivityTimeout < 5 || inactivityTimeout > 1440) {
        return res.status(400).json({
          message: "Inactivity timeout must be between 5 and 1440 minutes",
        });
      }
    }

    if (maxSessionDuration !== undefined) {
      if (maxSessionDuration < 15 || maxSessionDuration > 2880) {
        return res.status(400).json({
          message: "Max session duration must be between 15 and 2880 minutes",
        });
      }
    }

    // Get or create settings
    const settings = await SessionSettings.getSettings();

    // Update settings
    if (inactivityTimeout !== undefined) {
      settings.inactivityTimeout = inactivityTimeout;
    }
    if (maxSessionDuration !== undefined) {
      settings.maxSessionDuration = maxSessionDuration;
    }

    settings.lastUpdatedBy = req.admin._id;
    settings.lastUpdatedAt = new Date();

    await settings.save();

    res.status(200).json({
      message: "Session settings updated successfully",
      settings: {
        inactivityTimeout: settings.inactivityTimeout,
        maxSessionDuration: settings.maxSessionDuration,
        lastUpdatedAt: settings.lastUpdatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Error updating session settings:", error);
    res.status(500).json({ message: "Error updating session settings" });
  }
};

// Helper function to create a session (called on login)
export const createSession = async (user, token, req) => {
  try {
    // Check if user already has an active session with this token
    const existingSession = await Session.findOne({
      token,
      isActive: true,
    });

    if (existingSession) {
      // Update existing session
      existingSession.lastActivity = new Date();
      existingSession.ipAddress = req.ip || req.connection.remoteAddress;
      existingSession.userAgent = req.get("user-agent");
      await existingSession.save();
      console.log("✅ Updated existing session for:", user.email);
      return existingSession;
    }

    // Check if user has other active sessions (different browser/device)
    // We allow multiple active sessions (one per browser/device)
    // But we can optionally deactivate old sessions if needed
    
    // Create new session (allows multiple sessions per user for different browsers)
    const session = await Session.create({
      userId: user._id,
      token,
      email: user.email,
      name: user.name,
      role: user.role || "counselor",
      loginTime: new Date(),
      lastActivity: new Date(),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("user-agent"),
      isActive: true,
    });

    console.log("✅ Created new session for:", user.email, "Session ID:", session._id);
    return session;
  } catch (error) {
    console.error("❌ Error creating session:", error);
    throw error;
  }
};

// Helper function to deactivate a session (called on logout)
export const deactivateSession = async (token) => {
  try {
    if (!token) {
      console.warn("⚠️ No token provided to deactivateSession");
      return;
    }

    // Find session by token
    const session = await Session.findOne({ token, isActive: true });
    if (session) {
      session.isActive = false;
      await session.save();
      console.log("✅ Deactivated session for:", session.email, "Session ID:", session._id);
    } else {
      console.warn("⚠️ No active session found for token");
    }
  } catch (error) {
    console.error("❌ Error deactivating session:", error);
  }
};

// Helper function to deactivate all sessions for a user (by userId or email)
export const deactivateAllUserSessions = async (userId, email) => {
  try {
    const query = { isActive: true };
    if (userId) {
      query.userId = userId;
    }
    if (email) {
      query.email = email.toLowerCase();
    }

    const sessions = await Session.find(query);
    if (sessions.length > 0) {
      await Session.updateMany(query, { isActive: false });
      console.log(`✅ Deactivated ${sessions.length} session(s) for user: ${email || userId}`);
    }
  } catch (error) {
    console.error("❌ Error deactivating all user sessions:", error);
  }
};

