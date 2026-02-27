import Counselor from "../models/Counselor.js";
import GoogleUser from "../models/GoogleUser.js";
import ActivityLog from "../models/ActivityLog.js";
import bcrypt from "bcryptjs";
import { validatePassword } from "../utils/passwordValidation.js";
import { getFileUrl, deleteProfilePictureFile } from "../middleware/uploadMiddleware.js";
import path from "path";
import fs from "fs";

// Helper function to get client IP and user agent
const getClientInfo = (req) => ({
  ipAddress: req.ip || req.connection.remoteAddress || "unknown",
  userAgent: req.headers["user-agent"] || "unknown",
});

// Helper function to create activity log
const createActivityLog = async (req, activityType, description, metadata = {}) => {
  try {
    const user = req.user;
    const clientInfo = getClientInfo(req);
    
    await ActivityLog.create({
      userId: user._id,
      userModel: user.googleId ? "GoogleUser" : "Counselor",
      userEmail: user.email,
      userName: user.name,
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

// Helper function to find user (check both User and GoogleUser collections)
const findUserById = async (userId) => {
  let user = await Counselor.findById(userId);
  let userModel = "Counselor";
  
  if (!user) {
    user = await GoogleUser.findById(userId);
    userModel = "GoogleUser";
  }
  
  return { user, userModel };
};

// Helper function to save user based on model type
const saveUser = async (user, userModel) => {
  if (userModel === "Counselor") {
    await user.save();
  } else if (userModel === "GoogleUser") {
    await user.save();
  }
};

// ===========================
// 1. GET PROFILE
// ===========================
export const getProfile = async (req, res) => {
  try {
    // Ensure only counselors can access their own profile
    if (req.user.role !== "counselor") {
      return res.status(403).json({
        message: "Access denied. Only counselors can access this profile.",
      });
    }

    const { user, userModel } = await findUserById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create activity log
    await createActivityLog(req, "profile_viewed", "Viewed profile settings");

    // Get base URL for full image URLs (use backend server URL, not client URL)
    const baseUrl = process.env.API_URL || process.env.BACKEND_URL || req.protocol + "://" + req.get("host");
    
    // Return profile data (exclude sensitive information)
    const profileData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
      profilePicture: user.profilePicture ? getFileUrl(user.profilePicture, baseUrl) : null,
      phoneNumber: user.phoneNumber || null,
      bio: user.bio || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isGoogleUser: userModel === "GoogleUser",
    };

    res.status(200).json({
      success: true,
      message: "Profile retrieved successfully",
      profile: profileData,
    });
  } catch (error) {
    console.error("❌ Error fetching profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ===========================
// 2. UPDATE PROFILE
// ===========================
export const updateProfile = async (req, res) => {
  try {
    // Ensure only counselors can update their own profile
    if (req.user.role !== "counselor") {
      return res.status(403).json({
        message: "Access denied. Only counselors can update their profile.",
      });
    }

    const { user, userModel } = await findUserById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
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
      if (user.name !== name.trim()) {
        updates.name = name.trim();
        metadata.oldName = user.name;
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

      // Check if email already exists (in both User and GoogleUser collections)
      const existingUser = await Counselor.findOne({ email, _id: { $ne: user._id } });
      const existingGoogleUser = await GoogleUser.findOne({ email, _id: { $ne: user._id } });

      if (existingUser || existingGoogleUser) {
        return res.status(400).json({
          success: false,
          message: "Email already in use by another account",
        });
      }

      if (user.email !== email.toLowerCase().trim()) {
        updates.email = email.toLowerCase().trim();
        metadata.oldEmail = user.email;
        metadata.newEmail = email.toLowerCase().trim();
      }
    }

    // Validate and update phone number
    if (phoneNumber !== undefined) {
      if (phoneNumber === "" || phoneNumber === null) {
        updates.phoneNumber = null;
      } else {
        const phoneRegex = /^[\d\s\-\+\(\)]+$/;
        if (!phoneRegex.test(phoneNumber) || phoneNumber.length > 20) {
          return res.status(400).json({
            success: false,
            message: "Invalid phone number format",
          });
        }
        if (user.phoneNumber !== phoneNumber.trim()) {
          updates.phoneNumber = phoneNumber.trim();
        }
      }
    }

    // Validate and update bio
    if (bio !== undefined) {
      if (bio === "" || bio === null) {
        updates.bio = null;
      } else {
        if (typeof bio !== "string" || bio.length > 500) {
          return res.status(400).json({
            success: false,
            message: "Bio must be 500 characters or less",
          });
        }
        if (user.bio !== bio.trim()) {
          updates.bio = bio.trim();
        }
      }
    }

    // If no updates, return early
    if (Object.keys(updates).length === 0) {
      return res.status(200).json({
        success: true,
        message: "No changes detected",
        profile: {
          id: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber || null,
          bio: user.bio || null,
        },
      });
    }

    // Apply updates
    Object.assign(user, updates);
    await saveUser(user, userModel);

    // Create activity log
    await createActivityLog(
      req,
      "profile_updated",
      `Updated profile: ${Object.keys(updates).join(", ")}`,
      metadata
    );

    // Get base URL for full image URLs (use backend server URL, not client URL)
    const baseUrl = process.env.API_URL || process.env.BACKEND_URL || req.protocol + "://" + req.get("host");
    
    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      profile: {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber || null,
        bio: user.bio || null,
        profilePicture: user.profilePicture ? getFileUrl(user.profilePicture, baseUrl) : null,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Error updating profile:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ===========================
// 3. CHANGE PASSWORD
// ===========================
export const changePassword = async (req, res) => {
  try {
    // Ensure only counselors can change their password
    if (req.user.role !== "counselor") {
      return res.status(403).json({
        message: "Access denied. Only counselors can change their password.",
      });
    }

    // Google users cannot change password through this endpoint
    if (req.user.googleId) {
      return res.status(400).json({
        success: false,
        message: "Google-authenticated users cannot change password here. Use Google account settings.",
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    const { user, userModel } = await findUserById(req.user._id);

    if (!user || !user.password) {
      return res.status(404).json({
        success: false,
        message: "User not found or password not set",
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Enhanced password validation with email and name
    const validation = validatePassword(newPassword, { email: user.email || "", name: user.name || "" });
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: "New password does not meet security requirements",
        errors: validation.errors,
      });
    }

    // Check if new password is different from current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    await saveUser(user, userModel);

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

// ===========================
// 4. UPLOAD PROFILE PICTURE
// ===========================
export const handleProfilePictureUpload = async (req, res) => {
  try {
    // Ensure only counselors can upload profile picture
    if (req.user.role !== "counselor") {
      return res.status(403).json({
        message: "Access denied. Only counselors can upload profile pictures.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const { user, userModel } = await findUserById(req.user._id);

    if (!user) {
      // Delete uploaded file if user not found
      const filePath = req.file.path;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(404).json({ message: "User not found" });
    }

    // Delete old profile picture if exists
    if (user.profilePicture) {
      await deleteProfilePictureFile(user.profilePicture);
    }

    // Update profile picture path
    user.profilePicture = req.file.filename;
    await saveUser(user, userModel);

    // Create activity log
    await createActivityLog(req, "profile_picture_uploaded", `Uploaded profile picture: ${req.file.filename}`, {
      fileName: req.file.filename,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });

    // Get base URL for full image URLs (use backend server URL, not client URL)
    const baseUrl = process.env.API_URL || process.env.BACKEND_URL || req.protocol + "://" + req.get("host");
    
    res.status(200).json({
      success: true,
      message: "Profile picture uploaded successfully",
      profilePicture: getFileUrl(req.file.filename, baseUrl),
    });
  } catch (error) {
    console.error("❌ Error uploading profile picture:", error);
    
    // Clean up uploaded file on error
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: "Failed to upload profile picture",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ===========================
// 5. REMOVE PROFILE PICTURE
// ===========================
export const removeProfilePicture = async (req, res) => {
  try {
    // Ensure only counselors can remove profile picture
    if (req.user.role !== "counselor") {
      return res.status(403).json({
        message: "Access denied. Only counselors can remove profile pictures.",
      });
    }

    const { user, userModel } = await findUserById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.profilePicture) {
      return res.status(400).json({
        success: false,
        message: "No profile picture to remove",
      });
    }

    // Delete the file
    await deleteProfilePictureFile(user.profilePicture);

    // Remove profile picture reference
    user.profilePicture = null;
    await saveUser(user, userModel);

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

// ===========================
// 6. GET ACTIVITY LOGS
// ===========================
export const getActivityLogs = async (req, res) => {
  try {
    // Ensure only counselors can view their activity logs
    if (req.user.role !== "counselor") {
      return res.status(403).json({
        message: "Access denied. Only counselors can view activity logs.",
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get activity logs for this user
    const logs = await ActivityLog.find({
      userId: req.user._id,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v")
      .lean();

    const totalLogs = await ActivityLog.countDocuments({
      userId: req.user._id,
    });

    // Create activity log for viewing activity logs
    await createActivityLog(req, "account_activity_viewed", `Viewed activity logs (page ${page})`);

    res.status(200).json({
      success: true,
      message: "Activity logs retrieved successfully",
      logs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalLogs / limit),
        totalLogs,
        hasMore: skip + logs.length < totalLogs,
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

