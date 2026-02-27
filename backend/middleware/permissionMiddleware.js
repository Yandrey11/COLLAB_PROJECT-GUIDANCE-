import jwt from "jsonwebtoken";
import Counselor from "../models/Counselor.js";
import GoogleUser from "../models/GoogleUser.js";
import Admin from "../models/Admin.js";
import AuditLog from "../models/AuditLog.js";

/**
 * Authorization middleware to check if user has required permission
 * @param {string} requiredPermission - The permission to check (e.g., 'can_view_records')
 */
export const authorize = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      // Get user from request (set by auth middleware)
      let user = req.user || req.admin;

      // If user is not set, try to get from token
      if (!user) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
          const token = authHeader.split(" ")[1];
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          
          // Try to find user in all collections
          user = await Counselor.findById(decoded.id).select("-password");
          
          if (!user) {
            user = await GoogleUser.findById(decoded.id);
          }
          
          if (!user) {
            user = await Admin.findById(decoded.id).select("-password");
          }
          
          if (!user) {
            return res.status(401).json({ message: "User not found" });
          }
        } else {
          return res.status(401).json({ message: "Not authorized, no token" });
        }
      }

      // Admins always have all permissions
      if (user.role === "admin" || user.permissions?.is_admin === true) {
        return next();
      }

      // Backwards compatibility: If permissions field doesn't exist or is empty, default to allowing access
      // This allows existing users to continue working until migration is run
      // Check if permissions field exists and has any keys
      const hasPermissionsField = user.permissions && typeof user.permissions === 'object';
      const hasPermissionKeys = hasPermissionsField && Object.keys(user.permissions).length > 0;
      
      if (!hasPermissionKeys) {
        console.warn(`⚠️ User ${user.email || user._id} doesn't have permissions set. Allowing access for backwards compatibility. Run migration script to set default permissions.`);
        return next();
      }

      // Check if user has the required permission
      const hasPermission = user.hasPermission 
        ? user.hasPermission(requiredPermission)
        : user.permissions?.[requiredPermission] === true;

      if (!hasPermission) {
        // Log denied access attempt
        try {
          await AuditLog.create({
            actorAdminId: user._id,
            actorModel: user.constructor.modelName || "Counselor",
            actorName: user.name || user.email,
            actorEmail: user.email,
            targetUserId: user._id,
            targetModel: user.constructor.modelName || "Counselor",
            targetUserName: user.name || user.email,
            targetUserEmail: user.email,
            action: "permission_denied",
            changedPermissions: {},
            ipAddress: req.ip || req.connection?.remoteAddress || req.headers["x-forwarded-for"]?.split(",")[0],
            userAgent: req.headers["user-agent"],
            metadata: {
              requiredPermission,
              endpoint: req.originalUrl,
              method: req.method,
              reason: "Insufficient permissions",
            },
          });
        } catch (auditError) {
          console.error("⚠️ Error creating audit log (non-critical):", auditError);
        }

        return res.status(403).json({
          message: `Access denied. Required permission: ${requiredPermission}`,
          requiredPermission,
        });
      }

      // Attach user to request for downstream use
      req.user = user;
      req.admin = user.role === "admin" ? user : req.admin;

      next();
    } catch (error) {
      console.error("❌ Error in permission middleware:", error);
      
      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({ message: "Invalid token" });
      }
      
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token expired" });
      }
      
      return res.status(500).json({ message: "Authorization check failed" });
    }
  };
};

/**
 * Middleware to check multiple permissions (user must have ALL)
 * @param {string[]} requiredPermissions - Array of permissions to check
 */
export const authorizeAll = (requiredPermissions) => {
  return async (req, res, next) => {
    try {
      let user = req.user || req.admin;

      if (!user) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
          const token = authHeader.split(" ")[1];
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          
          user = await Counselor.findById(decoded.id).select("-password");
          if (!user) {
            user = await GoogleUser.findById(decoded.id);
          }
          if (!user) {
            user = await Admin.findById(decoded.id).select("-password");
          }
          
          if (!user) {
            return res.status(401).json({ message: "User not found" });
          }
        } else {
          return res.status(401).json({ message: "Not authorized, no token" });
        }
      }

      // Admins always have all permissions
      if (user.role === "admin" || user.permissions?.is_admin === true) {
        return next();
      }

      // Check if user has all required permissions
      const hasAllPermissions = requiredPermissions.every((permission) => {
        return user.hasPermission 
          ? user.hasPermission(permission)
          : user.permissions?.[permission] === true;
      });

      if (!hasAllPermissions) {
        // Log denied access
        try {
          await AuditLog.create({
            actorAdminId: user._id,
            actorModel: user.constructor.modelName || "Counselor",
            actorName: user.name || user.email,
            actorEmail: user.email,
            targetUserId: user._id,
            targetModel: user.constructor.modelName || "Counselor",
            targetUserName: user.name || user.email,
            targetUserEmail: user.email,
            action: "permission_denied",
            changedPermissions: {},
            ipAddress: req.ip || req.connection?.remoteAddress || req.headers["x-forwarded-for"]?.split(",")[0],
            userAgent: req.headers["user-agent"],
            metadata: {
              requiredPermissions,
              endpoint: req.originalUrl,
              method: req.method,
              reason: "Insufficient permissions",
            },
          });
        } catch (auditError) {
          console.error("⚠️ Error creating audit log (non-critical):", auditError);
        }

        return res.status(403).json({
          message: `Access denied. Required permissions: ${requiredPermissions.join(", ")}`,
          requiredPermissions,
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error("❌ Error in permission middleware:", error);
      return res.status(500).json({ message: "Authorization check failed" });
    }
  };
};

/**
 * Middleware to check if user has ANY of the required permissions
 * @param {string[]} requiredPermissions - Array of permissions to check
 */
export const authorizeAny = (requiredPermissions) => {
  return async (req, res, next) => {
    try {
      let user = req.user || req.admin;

      if (!user) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
          const token = authHeader.split(" ")[1];
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          
          user = await Counselor.findById(decoded.id).select("-password");
          if (!user) {
            user = await GoogleUser.findById(decoded.id);
          }
          if (!user) {
            user = await Admin.findById(decoded.id).select("-password");
          }
          
          if (!user) {
            return res.status(401).json({ message: "User not found" });
          }
        } else {
          return res.status(401).json({ message: "Not authorized, no token" });
        }
      }

      // Admins always have all permissions
      if (user.role === "admin" || user.permissions?.is_admin === true) {
        return next();
      }

      // Check if user has at least one of the required permissions
      const hasAnyPermission = requiredPermissions.some((permission) => {
        return user.hasPermission 
          ? user.hasPermission(permission)
          : user.permissions?.[permission] === true;
      });

      if (!hasAnyPermission) {
        // Log denied access
        try {
          await AuditLog.create({
            actorAdminId: user._id,
            actorModel: user.constructor.modelName || "Counselor",
            actorName: user.name || user.email,
            actorEmail: user.email,
            targetUserId: user._id,
            targetModel: user.constructor.modelName || "Counselor",
            targetUserName: user.name || user.email,
            targetUserEmail: user.email,
            action: "permission_denied",
            changedPermissions: {},
            ipAddress: req.ip || req.connection?.remoteAddress || req.headers["x-forwarded-for"]?.split(",")[0],
            userAgent: req.headers["user-agent"],
            metadata: {
              requiredPermissions,
              endpoint: req.originalUrl,
              method: req.method,
              reason: "Insufficient permissions",
            },
          });
        } catch (auditError) {
          console.error("⚠️ Error creating audit log (non-critical):", auditError);
        }

        return res.status(403).json({
          message: `Access denied. Requires one of: ${requiredPermissions.join(", ")}`,
          requiredPermissions,
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error("❌ Error in permission middleware:", error);
      return res.status(500).json({ message: "Authorization check failed" });
    }
  };
};

