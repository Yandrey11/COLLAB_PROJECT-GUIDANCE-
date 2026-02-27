import Counselor from "../../models/Counselor.js";
import GoogleUser from "../../models/GoogleUser.js";
import Admin from "../../models/Admin.js";
import AuditLog from "../../models/AuditLog.js";
import { createNotification } from "./notificationController.js";

// Get user permissions
export const getUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find user in all collections
    let user = await Counselor.findById(userId);
    let userType = "Counselor";
    
    if (!user) {
      user = await GoogleUser.findById(userId);
      userType = "GoogleUser";
    }
    
    if (!user) {
      user = await Admin.findById(userId);
      userType = "Admin";
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get permissions (default values if not set)
    const permissions = {
      can_view_records: user.permissions?.can_view_records ?? (user.role === "admin" ? true : true),
      can_edit_records: user.permissions?.can_edit_records ?? (user.role === "admin" ? true : true),
      can_view_reports: user.permissions?.can_view_reports ?? (user.role === "admin" ? true : true),
      can_generate_reports: user.permissions?.can_generate_reports ?? (user.role === "admin" ? true : false),
      is_admin: user.permissions?.is_admin ?? (user.role === "admin" ? true : false),
    };

    res.status(200).json({
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      role: user.role,
      permissions,
    });
  } catch (error) {
    console.error("❌ Error fetching user permissions:", error);
    res.status(500).json({ message: "Error fetching user permissions" });
  }
};

// Update user permissions
export const updateUserPermissions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions: newPermissions } = req.body;
    const actorAdmin = req.admin || req.user;

    // Validate actor is admin
    if (!actorAdmin || (actorAdmin.role !== "admin" && !actorAdmin.permissions?.is_admin)) {
      return res.status(403).json({ message: "Only admins can update permissions" });
    }

    // Validate permissions object
    const allowedPermissions = [
      "can_view_records",
      "can_edit_records",
      "can_view_reports",
      "can_generate_reports",
      "is_admin",
    ];

    if (!newPermissions || typeof newPermissions !== "object") {
      return res.status(400).json({ message: "Invalid permissions object" });
    }

    // Validate all keys are allowed
    const permissionKeys = Object.keys(newPermissions);
    const invalidKeys = permissionKeys.filter((key) => !allowedPermissions.includes(key));
    if (invalidKeys.length > 0) {
      return res.status(400).json({
        message: `Invalid permission keys: ${invalidKeys.join(", ")}`,
      });
    }

    // Validate all values are booleans
    for (const [key, value] of Object.entries(newPermissions)) {
      if (typeof value !== "boolean") {
        return res.status(400).json({
          message: `Permission ${key} must be a boolean value`,
        });
      }
    }

    // Find user in all collections
    let user = await Counselor.findById(userId);
    let userType = "Counselor";
    
    if (!user) {
      user = await GoogleUser.findById(userId);
      userType = "GoogleUser";
    }
    
    if (!user) {
      user = await Admin.findById(userId);
      userType = "Admin";
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent admin from removing is_admin from themselves if they're the only admin
    if (newPermissions.is_admin === false && user._id.toString() === actorAdmin._id.toString()) {
      // Check if this is the only admin
      const adminCount = await Admin.countDocuments({ "permissions.is_admin": true });
      const userAdminCount = await Counselor.countDocuments({ "permissions.is_admin": true, role: "admin" });
      
      if (adminCount + userAdminCount <= 1) {
        return res.status(400).json({
          message: "Cannot remove admin privileges. At least one admin must remain in the system.",
        });
      }
    }

    // Prevent removing is_admin from the only admin
    if (newPermissions.is_admin === false && user.permissions?.is_admin === true) {
      const adminCount = await Admin.countDocuments({ "permissions.is_admin": true });
      const userAdminCount = await Counselor.countDocuments({
        "permissions.is_admin": true,
        role: "admin",
        _id: { $ne: user._id },
      });
      
      if (adminCount + userAdminCount === 0) {
        return res.status(400).json({
          message: "Cannot remove admin privileges. This is the only admin in the system.",
        });
      }
    }

    // Get old permissions for audit log
    const oldPermissions = {
      can_view_records: user.permissions?.can_view_records ?? (user.role === "admin" ? true : true),
      can_edit_records: user.permissions?.can_edit_records ?? (user.role === "admin" ? true : true),
      can_view_reports: user.permissions?.can_view_reports ?? (user.role === "admin" ? true : true),
      can_generate_reports: user.permissions?.can_generate_reports ?? (user.role === "admin" ? true : false),
      is_admin: user.permissions?.is_admin ?? (user.role === "admin" ? true : false),
    };

    // Track changes for audit log
    const changedPermissions = {};
    for (const key of allowedPermissions) {
      if (newPermissions.hasOwnProperty(key)) {
        const oldValue = oldPermissions[key];
        const newValue = newPermissions[key];
        if (oldValue !== newValue) {
          changedPermissions[key] = {
            from: oldValue,
            to: newValue,
          };
        }
      }
    }

    // Update permissions
    if (!user.permissions) {
      user.permissions = {};
    }

    // Apply new permissions (only update provided keys)
    for (const [key, value] of Object.entries(newPermissions)) {
      user.permissions[key] = value;
    }

    // If is_admin is false, ensure other permissions align (optional, but good practice)
    if (user.permissions.is_admin === false && user.role !== "admin") {
      // Keep permissions as set, but admins always have all permissions
    }

    await user.save();

    // Create audit log entry
    try {
      const actorModel = actorAdmin.constructor.modelName || "Admin";
      
      await AuditLog.create({
        actorAdminId: actorAdmin._id,
        actorModel,
        actorName: actorAdmin.name || actorAdmin.email,
        actorEmail: actorAdmin.email,
        targetUserId: user._id,
        targetModel: userType,
        targetUserName: user.name,
        targetUserEmail: user.email,
        action: Object.keys(changedPermissions).length > 0 ? "permission_update" : "permission_update",
        changedPermissions,
        ipAddress: req.ip || req.connection?.remoteAddress || req.headers["x-forwarded-for"]?.split(",")[0],
        userAgent: req.headers["user-agent"],
        metadata: {
          role: user.role,
          previousRole: user.role,
        },
      });
    } catch (auditError) {
      console.error("⚠️ Error creating audit log (non-critical):", auditError);
    }

    // Create notification for affected user
    if (Object.keys(changedPermissions).length > 0 && user.role === "counselor") {
      try {
        const permissionMessages = [];
        
        if (changedPermissions.can_view_records) {
          permissionMessages.push(
            changedPermissions.can_view_records.to
              ? "access to Records Page was granted"
              : "access to Records Page was removed"
          );
        }
        
        if (changedPermissions.can_edit_records) {
          permissionMessages.push(
            changedPermissions.can_edit_records.to
              ? "permission to edit records was granted"
              : "permission to edit records was removed"
          );
        }
        
        if (changedPermissions.can_view_reports) {
          permissionMessages.push(
            changedPermissions.can_view_reports.to
              ? "access to Reports Page was granted"
              : "access to Reports Page was removed"
          );
        }
        
        if (changedPermissions.can_generate_reports) {
          permissionMessages.push(
            changedPermissions.can_generate_reports.to
              ? "permission to generate reports was granted"
              : "permission to generate reports was removed"
          );
        }

        const messageText = permissionMessages.length > 0
          ? `Your ${permissionMessages.join(", ")} by Admin ${actorAdmin.name || actorAdmin.email} on ${new Date().toLocaleString()}.`
          : `Your permissions were updated by Admin ${actorAdmin.name || actorAdmin.email} on ${new Date().toLocaleString()}.`;

        await createNotification({
          title: "Permission Updated",
          description: messageText,
          category: "System Alert",
          priority: "high",
          metadata: {
            userId: user._id.toString(),
            userEmail: user.email,
            changedPermissions: Object.keys(changedPermissions),
            actorAdminId: actorAdmin._id.toString(),
            actorAdminName: actorAdmin.name || actorAdmin.email,
          },
          relatedId: user._id,
          relatedType: "user",
        });
      } catch (notificationError) {
        console.error("⚠️ Error creating notification (non-critical):", notificationError);
      }
    }

    // Get updated permissions
    const updatedPermissions = {
      can_view_records: user.permissions?.can_view_records ?? true,
      can_edit_records: user.permissions?.can_edit_records ?? true,
      can_view_reports: user.permissions?.can_view_reports ?? true,
      can_generate_reports: user.permissions?.can_generate_reports ?? false,
      is_admin: user.permissions?.is_admin ?? (user.role === "admin" ? true : false),
    };

    res.status(200).json({
      message: "Permissions updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: updatedPermissions,
      },
      changes: changedPermissions,
    });
  } catch (error) {
    console.error("❌ Error updating user permissions:", error);
    res.status(500).json({ message: "Error updating user permissions" });
  }
};


