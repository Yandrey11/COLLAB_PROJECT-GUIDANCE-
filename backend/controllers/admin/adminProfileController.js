import Admin from "../../models/Admin.js";
import Counselor from "../../models/Counselor.js";
import ActivityLog from "../../models/ActivityLog.js";
import bcrypt from "bcryptjs";
import { validatePassword } from "../../utils/passwordValidation.js";
import { getFileUrl, deleteProfilePictureFile } from "../../middleware/uploadMiddleware.js";
import path from "path";
import fs from "fs";

// Helper function to get client IP and user agent
const getClientInfo = (req) => ({
  ipAddress: req.ip || req.connection.remoteAddress || "unknown",
  userAgent: req.headers["user-agent"] || "unknown",
});

/**
 * Admin portal JWT may refer to an Admin document or a Counselor with role "admin"
 * (see adminLoginController + protectAdmin). Resolve the backing Mongoose document.
 */
const resolveAdminAccount = async (adminId, { excludePassword = false } = {}) => {
  const qAdmin = excludePassword ? Admin.findById(adminId).select("-password") : Admin.findById(adminId);
  let doc = await qAdmin;
  if (doc) return doc;

  const qUser = excludePassword
    ? Counselor.findById(adminId).select("-password")
    : Counselor.findById(adminId);
  doc = await qUser;
  if (doc && doc.role === "admin") return doc;
  return null;
};

// Helper function to create activity log
const createActivityLog = async (req, activityType, description, metadata = {}) => {
  try {
    const admin = req.admin;
    const clientInfo = getClientInfo(req);
    
    await ActivityLog.create({
      userId: admin._id,
      userModel: "Admin",
      userEmail: admin.email,
      userName: admin.name,
      activityType,
      description,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      metadata,
    });
  } catch (error) {
    console.error("⚠️ Error creating activity log:", error);
    // Don't throw - activity logging failure shouldn't break the flow
  }
};

/**
 * GET /api/admin/profile
 * Get admin profile information
 */
export const getProfile = async (req, res) => {
  try {
    const admin = await resolveAdminAccount(req.admin._id, { excludePassword: true });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Create activity log
    await createActivityLog(req, "profile_viewed", "Viewed admin profile settings");

    // Get base URL for full image URLs
    const baseUrl = process.env.API_URL || process.env.BACKEND_URL || req.protocol + "://" + req.get("host");

    // Return profile data
    const profileData = {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      profilePicture: admin.profilePicture ? getFileUrl(admin.profilePicture, baseUrl) : null,
      phoneNumber: admin.phoneNumber || null,
      bio: admin.bio || null,
      settings: admin.settings || {
        display: {
          theme: "light",
          uiDensity: "normal",
          defaultDashboardView: "records",
        },
        notifications: {
          newUserCreations: true,
          recordUpdates: true,
          criticalSystemAlerts: true,
          pdfGenerations: true,
          loginAttempts: false,
          soundEnabled: false,
        },
        privacy: {
          hideProfilePhoto: false,
          maskNameInNotifications: false,
        },
      },
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };

    res.status(200).json({
      success: true,
      message: "Profile retrieved successfully",
      profile: profileData,
    });
  } catch (error) {
    console.error("❌ Error fetching admin profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * PUT /api/admin/profile
 * Update admin profile information
 */
export const updateProfile = async (req, res) => {
  try {
    const admin = await resolveAdminAccount(req.admin._id, { excludePassword: true });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    const { name, email, phoneNumber, bio } = req.body;
    const updates = {};
    const metadata = {};

    // Validate and update name
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 100) {
        return res.status(400).json({
          success: false,
          message: "Name must be between 2 and 100 characters",
        });
      }
      if (admin.name !== name.trim()) {
        updates.name = name.trim();
        metadata.oldName = admin.name;
        metadata.newName = name.trim();
      }
    }

    // Validate and update email
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }

      // Check if email is already taken by another account (Admin or Counselor)
      const emailTrim = email.trim();
      const existingAdmin = await Admin.findOne({ email: emailTrim, _id: { $ne: admin._id } });
      const existingCounselor = await Counselor.findOne({ email: emailTrim, _id: { $ne: admin._id } });
      if (existingAdmin || existingCounselor) {
        return res.status(400).json({
          success: false,
          message: "Email is already in use",
        });
      }

      if (admin.email !== email.trim()) {
        updates.email = email.trim();
        metadata.oldEmail = admin.email;
        metadata.newEmail = email.trim();
      }
    }

    // Validate and update phone number
    if (phoneNumber !== undefined) {
      if (phoneNumber && phoneNumber.trim().length > 0) {
        const phoneRegex = /^[\d\s\-\+\(\)]+$/;
        if (!phoneRegex.test(phoneNumber.trim())) {
          return res.status(400).json({
            success: false,
            message: "Invalid phone number format",
          });
        }
        updates.phoneNumber = phoneNumber.trim();
        metadata.phoneNumber = phoneNumber.trim();
      } else {
        updates.phoneNumber = null;
      }
    }

    // Validate and update bio
    if (bio !== undefined) {
      if (bio && bio.trim().length > 500) {
        return res.status(400).json({
          success: false,
          message: "Bio must be 500 characters or less",
        });
      }
      updates.bio = bio && bio.trim().length > 0 ? bio.trim() : null;
      metadata.bio = updates.bio;
    }

    // Apply updates
    Object.keys(updates).forEach((key) => {
      admin[key] = updates[key];
    });

    await admin.save();

    // Create activity log
    await createActivityLog(req, "profile_updated", "Updated profile information", metadata);

    // Get base URL for full image URLs
    const baseUrl = process.env.API_URL || process.env.BACKEND_URL || req.protocol + "://" + req.get("host");

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      profile: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        phoneNumber: admin.phoneNumber,
        bio: admin.bio,
        profilePicture: admin.profilePicture ? getFileUrl(admin.profilePicture, baseUrl) : null,
      },
    });
  } catch (error) {
    console.error("❌ Error updating admin profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * PUT /api/admin/profile/password
 * Change admin password with current password verification
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    const admin = await resolveAdminAccount(req.admin._id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    if (!admin.password) {
      return res.status(400).json({
        success: false,
        message: "No password is set for this account. Use Forgot Password to create one.",
      });
    }

    // Verify current password
    const isMatch = await admin.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Enhanced password validation with email and name
    const validationResult = validatePassword(newPassword, { email: admin.email || "", name: admin.name || "" });
    if (!validationResult.isValid) {
      return res.status(400).json({
        success: false,
        message: "New password does not meet security requirements",
        errors: validationResult.errors,
      });
    }

    // Check if new password is same as current password
    const isSamePassword = await admin.matchPassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    // Update password
    admin.password = newPassword;
    await admin.save();

    // Create activity log
    await createActivityLog(req, "password_changed", "Changed password");

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("❌ Error changing password:", error);
    res.status(500).json({
      success: false,
      message: "Failed to change password",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * POST /api/admin/profile/picture
 * Upload or update admin profile picture
 */
export const handleProfilePictureUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const admin = await resolveAdminAccount(req.admin._id, { excludePassword: true });

    if (!admin) {
      // Delete uploaded file if admin not found
      if (req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          console.error("Error deleting file:", err);
        }
      }
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Delete old profile picture if exists
    if (admin.profilePicture) {
      try {
        await deleteProfilePictureFile(admin.profilePicture);
      } catch (err) {
        console.error("Error deleting old profile picture:", err);
        // Continue even if deletion fails
      }
    }

    // Store filename only to keep DB values portable across environments
    admin.profilePicture = req.file.filename;
    await admin.save();

    // Create activity log
    await createActivityLog(req, "profile_picture_updated", "Updated profile picture");

    // Get base URL for full image URL
    const baseUrl = process.env.API_URL || process.env.BACKEND_URL || req.protocol + "://" + req.get("host");

    res.status(200).json({
      success: true,
      message: "Profile picture uploaded successfully",
      profilePicture: getFileUrl(admin.profilePicture, baseUrl),
    });
  } catch (error) {
    console.error("❌ Error uploading profile picture:", error);
    
    // Delete uploaded file on error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error("Error deleting file on error:", err);
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to upload profile picture",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * DELETE /api/admin/profile/picture
 * Remove admin profile picture
 */
export const removeProfilePicture = async (req, res) => {
  try {
    const admin = await resolveAdminAccount(req.admin._id, { excludePassword: true });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    if (!admin.profilePicture) {
      return res.status(400).json({
        success: false,
        message: "No profile picture to remove",
      });
    }

    // Delete file from filesystem
    try {
      await deleteProfilePictureFile(admin.profilePicture);
    } catch (err) {
      console.error("Error deleting profile picture file:", err);
      // Continue even if file deletion fails
    }

    // Remove reference from admin
    admin.profilePicture = null;
    await admin.save();

    // Create activity log
    await createActivityLog(req, "profile_picture_removed", "Removed profile picture");

    res.status(200).json({
      success: true,
      message: "Profile picture removed successfully",
    });
  } catch (error) {
    console.error("❌ Error removing profile picture:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove profile picture",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * GET /api/admin/profile/activity
 * Get admin activity logs
 */
export const getActivityLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get activity logs for this admin
    const logs = await ActivityLog.find({
      userId: req.admin._id,
      userModel: "Admin",
    })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const total = await ActivityLog.countDocuments({
      userId: req.admin._id,
      userModel: "Admin",
    });

    res.status(200).json({
      success: true,
      logs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalLogs: total,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching activity logs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch activity logs",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


