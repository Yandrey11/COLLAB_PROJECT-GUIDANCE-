import jwt from "jsonwebtoken";
import Admin from "../../models/Admin.js";
import User from "../../models/User.js";
import Session from "../../models/Session.js";
import { decryptToken } from "../../utils/tokenEncryption.js";


export const protectAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check if authorization header is present
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        success: false,
        message: "Not authorized. No token provided." 
      });
    }

    // Extract token from header
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: "Not authorized. Invalid token format." 
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        return res.status(401).json({ 
          success: false,
          message: "Token expired. Please log in again." 
        });
      } else if (jwtError.name === "JsonWebTokenError") {
        return res.status(401).json({ 
          success: false,
          message: "Invalid token. Please log in again." 
        });
      } else {
        return res.status(401).json({ 
          success: false,
          message: "Token verification failed." 
        });
      }
    }

    // Verify admin role
    if (decoded.role !== "admin") {
      return res.status(403).json({ 
        success: false,
        message: "Access denied. Admins only." 
      });
    }

    // Check Admin collection first
    let admin = await Admin.findById(decoded.id).select("-password");
    
    // If not found in Admin collection, check User collection for admin role
    if (!admin) {
      const user = await User.findById(decoded.id).select("-password");
      if (user && user.role === "admin") {
        // Convert user to admin-like object for middleware
        admin = {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      }
    }

    // Verify admin exists
    if (!admin) {
      return res.status(404).json({ 
        success: false,
        message: "Admin not found. Please contact system administrator." 
      });
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
          success: false,
          message: "Session expired due to inactivity. Please log in again.",
          code: "SESSION_INACTIVE"
        });
      }

      // Update lastActivity on each request
      session.lastActivity = new Date();
      await session.save();
    }

    // Decrypt Google tokens for Drive/Calendar if present
    if (admin?.googleCalendarAccessToken) {
      const plain = admin.toObject ? admin.toObject() : { ...admin };
      plain.googleCalendarAccessToken = decryptToken(plain.googleCalendarAccessToken);
      plain.googleCalendarRefreshToken = decryptToken(plain.googleCalendarRefreshToken);
      admin = plain;
    }

    // Attach admin to request and proceed
    req.admin = admin;
    next();
  } catch (error) {
    console.error("❌ protectAdmin error:", error.message);
    return res.status(500).json({ 
      success: false,
      message: "Authentication error. Please try again." 
    });
  }
};
