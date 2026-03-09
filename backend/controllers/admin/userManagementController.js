import Counselor from "../../models/Counselor.js";
import GoogleUser from "../../models/GoogleUser.js";
import Admin from "../../models/Admin.js";
import Session from "../../models/Session.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { createNotification } from "./notificationController.js";

// Get all users with filters and pagination
export const getAllUsers = async (req, res) => {
  try {
    console.log("📥 getAllUsers called with query:", req.query);
    const { page = 1, limit = 10, search = "", role = "all", status = "all" } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = {};
    
    // Handle search
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
      ];
    }

    // Handle role filter
    if (role !== "all") {
      query.role = role;
    }

    // Note: We don't filter by accountStatus in the query anymore
    // Status filter will be applied after checking online status

    console.log("🔍 MongoDB query:", JSON.stringify(query, null, 2));

    // Get regular users
    const regularUsers = await Counselor.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    // Get Google users (apply same filters where applicable)
    const googleUsersQuery = {};
    if (search) {
      googleUsersQuery.$or = [
        { email: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
      ];
    }
    // Apply role filter to Google users (they now have a role field)
    if (role !== "all") {
      googleUsersQuery.role = role;
    }
    const googleUsers = await GoogleUser.find(googleUsersQuery)
      .sort({ createdAt: -1 })
      .lean();

    // Get admins (apply same filters where applicable)
    const adminQuery = {};
    if (search) {
      adminQuery.$or = [
        { email: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
      ];
    }
    // Admins have role "admin", so include them when role is "all" or "admin"
    const admins = role === "all" || role === "admin"
      ? await Admin.find(adminQuery)
          .select("-password")
          .sort({ createdAt: -1 })
          .lean()
      : [];

    // Combine all user types
    const allUsers = [
      ...regularUsers.map(u => ({ ...u, userType: "regular" })),
      ...googleUsers.map(u => ({ ...u, userType: "google" })),
      ...admins.map(u => ({ ...u, userType: "admin" }))
    ];

    console.log(`✅ Found ${regularUsers.length} regular users, ${googleUsers.length} Google users, and ${admins.length} admins`);

    // Get all active sessions to determine online status
    const activeSessions = await Session.find({ isActive: true }).select("userId email").lean();
    
    // Create sets for quick lookup
    const onlineUserIds = new Set();
    const onlineUserEmails = new Set();
    
    // Populate sets with active session data
    activeSessions.forEach(session => {
      if (session.userId) {
        onlineUserIds.add(session.userId.toString());
      }
      if (session.email) {
        onlineUserEmails.add(session.email.toLowerCase());
      }
    });

    console.log(`📊 Active sessions: ${activeSessions.length} total`);
    console.log(`📊 Online user IDs: ${onlineUserIds.size}, Online emails: ${onlineUserEmails.size}`);

    // Format response with online/offline status
    let formattedUsers = allUsers.map((user) => {
      const userId = user._id.toString();
      const userEmail = user.email?.toLowerCase();
      
      // Check online status:
      // - For regular users and admins: check by userId
      // - For Google users: check by email (since they might not have userId in sessions)
      // - Also check by email as fallback for all user types
      const isOnlineByUserId = onlineUserIds.has(userId);
      const isOnlineByEmail = userEmail && onlineUserEmails.has(userEmail);
      const isOnline = isOnlineByUserId || isOnlineByEmail;
      
      return {
        id: userId,
        name: user.name,
        email: user.email,
        role: user.role || (user.userType === "admin" ? "admin" : "counselor"), // Default role based on user type
        accountStatus: user.accountStatus || "active", // Keep for enable/disable functionality
        isOnline: isOnline, // true if user has at least one active session
        status: isOnline ? "active" : "offline", // Display status: "active" (online) or "offline"
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        userType: user.userType || "regular", // Track user type: "regular", "google", or "admin"
      };
    });

    // Filter by online/offline status if specified
    if (status === "active") {
      formattedUsers = formattedUsers.filter(user => user.isOnline === true);
    } else if (status === "offline") {
      formattedUsers = formattedUsers.filter(user => user.isOnline === false);
    }
    // If status is "all", show all users

    // Get total count after filtering
    const total = formattedUsers.length;

    // Apply pagination after filtering
    const paginatedUsers = formattedUsers.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      users: paginatedUsers,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    console.error("❌ Error fetching users:", error);
    console.error("Error details:", error.message);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      message: "Error fetching users",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

// Helper function to send password setup email
const sendPasswordSetupEmail = async (email, name, token) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const setupLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/set-password?token=${token}&email=${encodeURIComponent(email)}`;

    const mailOptions = {
      from: `"Support Team" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Set Your Password - Account Created",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">Welcome ${name}!</h2>
          <p>Your account has been created successfully. To complete your account setup, please set your password by clicking the link below:</p>
          <p style="margin: 30px 0;">
            <a href="${setupLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
              Set Your Password
            </a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #6b7280; word-break: break-all;">${setupLink}</p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">
            This link will expire in 24 hours. If you didn't request this account, please contact support.
          </p>
        </div>
      `,
      text: `Welcome ${name}!\n\nYour account has been created successfully. To complete your account setup, please set your password by visiting this link:\n\n${setupLink}\n\nThis link will expire in 24 hours.`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Password setup email sent to: ${email}`);
  } catch (error) {
    console.error("❌ Error sending password setup email:", error);
    throw error;
  }
};

// Create a new user
export const createUser = async (req, res) => {
  try {
    const { name, email, role } = req.body;

    // Validation
    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required" });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Role validation
    const validRoles = ["counselor", "admin"];
    const userRole = role || "counselor";
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role. Must be: counselor or admin" });
    }

    // Check for duplicate email across User, Admin, and GoogleUser collections
    const existingUser = await Counselor.findOne({ email });
    const existingAdmin = await Admin.findOne({ email });
    const existingGoogleUser = await GoogleUser.findOne({ email });
    if (existingUser || existingAdmin || existingGoogleUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Generate secure token for password setup
    const setupToken = crypto.randomBytes(32).toString("hex");
    const tokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    let newAccount;
    let accountType;

    // Generate a temporary password (will be replaced when user sets their password)
    const tempPassword = crypto.randomBytes(16).toString("hex");

    // Save to appropriate collection based on role
    if (userRole === "admin") {
      // Save to Admin collection
      newAccount = new Admin({
        name,
        email,
        password: tempPassword, // Temporary password, will be changed
        role: "admin",
      });
      // Store token in resetPasswordCode field (reusing existing field)
      newAccount.resetPasswordCode = setupToken;
      newAccount.resetPasswordExpires = new Date(tokenExpires);
      await newAccount.save();
      accountType = "admin";
    } else {
      // Save to Counselor collection (for counselor roles)
      newAccount = new Counselor({
        name,
        email,
        password: tempPassword, // Temporary password, will be changed
        role: userRole,
        accountStatus: "active",
        resetPasswordCode: setupToken,
        resetPasswordExpires: new Date(tokenExpires),
      });
      await newAccount.save();
      accountType = "counselor";
    }

    // Send password setup email
    try {
      await sendPasswordSetupEmail(email, name, setupToken);
    } catch (emailError) {
      console.error("❌ Failed to send password setup email:", emailError);
      // Continue even if email fails - user can request password reset later
    }

    // Create notification
    try {
      await createNotification({
        title: `New ${accountType === "admin" ? "Admin" : "Counselor"} Created`,
        description: `Admin created a new ${accountType === "admin" ? "admin" : "counselor"} account: ${email} (Role: ${userRole})`,
        category: "User Activity",
        priority: "medium",
        metadata: { 
          userId: newAccount._id, 
          createdBy: req.admin._id,
          accountType,
          role: userRole,
        },
      });
    } catch (notifError) {
      console.error("Failed to create notification:", notifError);
    }

    res.status(201).json({
      message: `${accountType === "admin" ? "Admin" : "Counselor"} created successfully`,
      user: {
        id: newAccount._id,
        name: newAccount.name,
        email: newAccount.email,
        role: newAccount.role || userRole,
        accountStatus: newAccount.accountStatus || "active",
      },
    });
  } catch (error) {
    console.error("❌ Error creating user:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Email already exists" });
    }
    res.status(500).json({ message: "Error creating user" });
  }
};

// Update user information
export const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, role } = req.body;

    // Check all collections: User, GoogleUser, Admin
    let user = await Counselor.findById(userId);
    let userType = "regular";
    
    if (!user) {
      user = await GoogleUser.findById(userId);
      userType = "google";
    }
    
    if (!user) {
      user = await Admin.findById(userId);
      userType = "admin";
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Email validation if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Check for duplicate email across all collections (excluding current user)
      const existingUser = await Counselor.findOne({ email, _id: { $ne: userId } });
      const existingGoogleUser = await GoogleUser.findOne({ email, _id: { $ne: userId } });
      const existingAdmin = await Admin.findOne({ email, _id: { $ne: userId } });
      
      if (existingUser || existingGoogleUser || existingAdmin) {
        return res.status(400).json({ message: "Email already exists" });
      }
      user.email = email;
    }

    // Update fields
    if (name) user.name = name;
    
    // Role can be updated for all user types (regular, admin, and Google users)
    if (role) {
      const validRoles = ["counselor", "admin"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }
      
      // For Google users, just update the role field (they stay in GoogleUser collection)
      if (userType === "google") {
        user.role = role;
      }
      // If changing to admin role, need to move to Admin collection
      // If changing from admin to user/counselor, need to move to Counselor collection
      else if (userType === "admin" && role !== "admin") {
        // Move from Admin to Counselor collection
        const newUser = new Counselor({
          name: user.name,
          email: user.email,
          password: user.password, // Keep existing password
          role: role,
          accountStatus: "active",
        });
        await newUser.save();
        await Admin.findByIdAndDelete(userId);
        user = newUser;
        userType = "regular";
      } else if (userType === "regular" && role === "admin") {
        // Move from Counselor to Admin collection
        const newAdmin = new Admin({
          name: user.name,
          email: user.email,
          password: user.password, // Keep existing password
          role: "admin",
        });
        await newAdmin.save();
        await Counselor.findByIdAndDelete(userId);
        user = newAdmin;
        userType = "admin";
      } else {
        // Just update role in same collection
        user.role = role;
      }
    }
    // Note: accountStatus is no longer editable - status is based on active sessions

    await user.save();

    // Create notification
    try {
      await createNotification({
        title: "User Updated",
        description: `Admin updated user account: ${user.email}`,
        category: "User Activity",
        priority: "medium",
        metadata: { userId: user._id, updatedBy: req.admin._id, userType },
      });
    } catch (notifError) {
      console.error("Failed to create notification:", notifError);
    }

    res.status(200).json({
      message: "User updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || (userType === "admin" ? "admin" : userType === "google" ? "counselor" : "counselor"),
      },
    });
  } catch (error) {
    console.error("❌ Error updating user:", error);
    res.status(500).json({ message: "Error updating user" });
  }
};

// Toggle user account status (activate/deactivate)
export const toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await Counselor.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent deactivating yourself
    if (user._id.toString() === req.admin._id.toString()) {
      return res.status(400).json({ message: "You cannot deactivate your own account" });
    }

    // Toggle status
    user.accountStatus = user.accountStatus === "active" ? "inactive" : "active";
    await user.save();

    // Create notification
    try {
      await createNotification({
        title: `User Account ${user.accountStatus === "active" ? "Activated" : "Deactivated"}`,
        description: `Admin ${user.accountStatus === "active" ? "activated" : "deactivated"} user account: ${user.email}`,
        category: "User Activity",
        priority: user.accountStatus === "inactive" ? "high" : "medium",
        metadata: { userId: user._id, actionBy: req.admin._id },
      });
    } catch (notifError) {
      console.error("Failed to create notification:", notifError);
    }

    res.status(200).json({
      message: `User account ${user.accountStatus === "active" ? "activated" : "deactivated"} successfully`,
      user: {
        id: user._id,
        email: user.email,
        accountStatus: user.accountStatus,
      },
    });
  } catch (error) {
    console.error("❌ Error toggling user status:", error);
    res.status(500).json({ message: "Error updating user status" });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check all collections: Counselor, GoogleUser, Admin
    let user = await Counselor.findById(userId);
    let userType = "regular";
    let collection = Counselor;
    
    if (!user) {
      user = await GoogleUser.findById(userId);
      userType = "google";
      collection = GoogleUser;
    }
    
    if (!user) {
      user = await Admin.findById(userId);
      userType = "admin";
      collection = Admin;
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prevent deleting yourself
    if (user._id.toString() === req.admin._id.toString()) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    const userEmail = user.email;

    // Delete user from the appropriate collection
    await collection.findByIdAndDelete(userId);

    // Also deactivate all sessions for this user
    try {
      await Session.updateMany(
        { 
          $or: [
            { userId: userId },
            { email: userEmail.toLowerCase() }
          ]
        },
        { isActive: false }
      );
    } catch (sessionError) {
      console.error("Failed to deactivate sessions:", sessionError);
    }

    // Create notification
    try {
      await createNotification({
        title: "User Deleted",
        description: `Admin deleted ${userType} account: ${userEmail}`,
        category: "User Activity",
        priority: "high",
        metadata: { deletedUserId: userId, deletedBy: req.admin._id, userType },
      });
    } catch (notifError) {
      console.error("Failed to create notification:", notifError);
    }

    res.status(200).json({
      message: "User deleted successfully",
      deletedUserId: userId,
    });
  } catch (error) {
    console.error("❌ Error deleting user:", error);
    res.status(500).json({ message: "Error deleting user" });
  }
};

// Helper function to send password reset email
const sendPasswordResetEmail = async (email, name, token) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const resetLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    const mailOptions = {
      from: `"Support Team" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">Password Reset Request</h2>
          <p>Hello ${name},</p>
          <p>You have requested to reset your password. Click the link below to set a new password:</p>
          <p style="margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
              Reset Password
            </a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #6b7280; word-break: break-all;">${resetLink}</p>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">
            This link will expire in 5 minutes. If you didn't request this password reset, please contact support immediately.
          </p>
        </div>
      `,
      text: `Hello ${name},\n\nYou have requested to reset your password. Please visit this link to set a new password:\n\n${resetLink}\n\nThis link will expire in 5 minutes.`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to: ${email}`);
  } catch (error) {
    console.error("❌ Error sending password reset email:", error);
    throw error;
  }
};

export const resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check all collections: User, GoogleUser, Admin
    let user = await Counselor.findById(userId);
    let userType = "regular";
    
    if (!user) {
      user = await GoogleUser.findById(userId);
      userType = "google";
    }
    
    if (!user) {
      user = await Admin.findById(userId);
      userType = "admin";
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Google users don't have passwords (they use OAuth)
    if (userType === "google") {
      const googleUser = user;
      let localUser = await Counselor.findOne({ email: googleUser.email });
      let localAdmin = await Admin.findOne({ email: googleUser.email });
      if (localAdmin) {
        user = localAdmin;
        userType = "admin";
      } else if (localUser) {
        user = localUser;
        userType = "regular";
      } else {
        const tempPassword = crypto.randomBytes(16).toString("hex");
        if (googleUser.role === "admin") {
          user = new Admin({
            name: googleUser.name,
            email: googleUser.email,
            password: tempPassword,
            role: "admin",
          });
          await user.save();
          userType = "admin";
        } else {
          user = new Counselor({
            name: googleUser.name,
            email: googleUser.email,
            password: tempPassword,
            role: googleUser.role || "counselor",
            accountStatus: "active",
          });
          await user.save();
          userType = "regular";
        }
      }
    }

    // Generate secure token for password reset
    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenExpires = Date.now() + 5 * 60 * 1000; // 5 minutes

    // Store token in resetPasswordCode field
    user.resetPasswordCode = resetToken;
    user.resetPasswordExpires = new Date(tokenExpires);
    await user.save();

    // Send password reset email
    try {
      await sendPasswordResetEmail(user.email, user.name, resetToken);
    } catch (emailError) {
      console.error("❌ Failed to send password reset email:", emailError);
      // Clear the token if email fails
      user.resetPasswordCode = null;
      user.resetPasswordExpires = null;
      await user.save();
      return res.status(500).json({ message: "Failed to send password reset email. Please try again." });
    }

    // Create notification
    try {
      await createNotification({
        title: "Password Reset Link Sent",
        description: `Admin sent password reset link to ${userType} account: ${user.email}`,
        category: "Security Alert",
        priority: "high",
        metadata: { userId: user._id, resetBy: req.admin._id, userType },
      });
    } catch (notifError) {
      console.error("Failed to create notification:", notifError);
    }

    res.status(200).json({
      message: "Password reset link has been sent to the user's email address.",
      userId: user._id,
    });
  } catch (error) {
    console.error("❌ Error sending password reset link:", error);
    res.status(500).json({ message: "Error sending password reset link" });
  }
};

