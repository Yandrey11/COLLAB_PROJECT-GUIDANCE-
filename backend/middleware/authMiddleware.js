import jwt from "jsonwebtoken";
import Counselor from "../models/Counselor.js";
import GoogleUser from "../models/GoogleUser.js";
import Admin from "../models/Admin.js";
import Session from "../models/Session.js";
import { decryptToken } from "../utils/tokenEncryption.js";

// ✅ Verify JWT and attach user to request
export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Try to find user in User collection first
    let user = await Counselor.findById(decoded.id).select("-password");
    
    // If not found, try GoogleUser collection (for Google OAuth users)
    if (!user) {
      const googleUser = await GoogleUser.findById(decoded.id);
      if (googleUser) {
        // Convert GoogleUser to user-like object; decrypt tokens for API use
        user = {
          _id: googleUser._id,
          id: googleUser._id,
          name: googleUser.name,
          email: googleUser.email,
          role: googleUser.role || "counselor",
          googleId: googleUser.googleId,
          googleCalendarAccessToken: decryptToken(googleUser.googleCalendarAccessToken) || null,
          googleCalendarRefreshToken: decryptToken(googleUser.googleCalendarRefreshToken) || null,
          googleCalendarTokenExpires: googleUser.googleCalendarTokenExpires || null,
        };
      }
    }
    
    // If still not found, try Admin collection (for admin users)
    if (!user) {
      const admin = await Admin.findById(decoded.id).select("-password");
      if (admin) {
        // Convert Admin to user-like object for compatibility
        user = {
          _id: admin._id,
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role || "admin",
        };
      }
    } else if (user && !user.googleCalendarAccessToken) {
      // If user is from User collection but has googleId, check GoogleUser for calendar tokens
      if (user.googleId) {
        const googleUser = await GoogleUser.findOne({ googleId: user.googleId });
        if (googleUser && googleUser.googleCalendarAccessToken) {
          user.googleCalendarAccessToken = decryptToken(googleUser.googleCalendarAccessToken);
          user.googleCalendarRefreshToken = decryptToken(googleUser.googleCalendarRefreshToken);
          user.googleCalendarTokenExpires = googleUser.googleCalendarTokenExpires;
        }
      }
    }

    // Decrypt tokens for User documents (tokens stored encrypted in DB)
    if (user?.googleCalendarAccessToken) {
      const plain = user.toObject ? user.toObject() : { ...user };
      plain.googleCalendarAccessToken = decryptToken(plain.googleCalendarAccessToken);
      plain.googleCalendarRefreshToken = decryptToken(plain.googleCalendarRefreshToken);
      user = plain;
    }

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Check session inactivity (1 hour timeout)
    const session = await Session.findOne({ 
      token: token,
      isActive: true 
    });

    if (session) {
      const now = new Date();
      const lastActivityTime = new Date(session.lastActivity);
      const inactivityDuration = now - lastActivityTime;
      const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

      if (inactivityDuration > INACTIVITY_TIMEOUT_MS) {
        // Session expired due to inactivity
        session.isActive = false;
        await session.save();

        return res.status(401).json({ 
          message: "Session expired due to inactivity. Please log in again.",
          code: "SESSION_INACTIVE"
        });
      }

      // Update lastActivity on each request
      session.lastActivity = new Date();
      await session.save();
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

// ✅ Allow access only if user role is "admin"
export const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied: Admins only" });
  }
  next();
};
