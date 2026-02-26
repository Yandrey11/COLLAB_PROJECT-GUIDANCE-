import nodemailer from "nodemailer";
import crypto from "crypto";
import User from "../models/User.js";
import Admin from "../models/Admin.js";
import GoogleUser from "../models/GoogleUser.js";
import { validatePassword } from "../utils/passwordValidation.js";

// ✅ Forgot Password — send code to user's email
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body; // ✅ FIX: define 'email' properly

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    console.log("📩 Forgot password request for:", email);

    const emailRegex = new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    let user = await User.findOne({ email: emailRegex });
    if (!user) {
      user = await Admin.findOne({ email: emailRegex });
    }
    if (!user) {
      // Google-only user: create User or Admin so they can set a password for manual login
      const googleUser = await GoogleUser.findOne({ email: emailRegex });
      if (googleUser) {
        const tempPassword = crypto.randomBytes(24).toString("hex");
        if (googleUser.role === "admin") {
          user = await Admin.create({
            name: googleUser.name,
            email,
            password: tempPassword,
            role: "admin",
            googleId: googleUser.googleId,
            profilePicture: googleUser.profilePicture,
          });
          console.log(`✅ Admin created from GoogleUser for forgot password: ${email}`);
        } else {
          user = await User.create({
            name: googleUser.name,
            email,
            password: tempPassword,
            role: googleUser.role || "counselor",
            accountStatus: "active",
            profilePicture: googleUser.profilePicture,
          });
          console.log(`✅ User created from GoogleUser for forgot password: ${email}`);
        }
      }
    }
    if (!user) {
      // Debug: check if email exists in any collection (for troubleshooting)
      const inUser = await User.exists({ email: emailRegex });
      const inAdmin = await Admin.exists({ email: emailRegex });
      const inGoogle = await GoogleUser.exists({ email: emailRegex });
      console.log("❌ No user found in DB");
      console.log(`   User: ${!!inUser}, Admin: ${!!inAdmin}, GoogleUser: ${!!inGoogle}`);
      return res.status(404).json({ message: "No user found with this email" });
    }

    // ✅ Generate 6-digit code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordCode = resetCode;
    user.resetPasswordExpires = Date.now() + 5 * 60 * 1000;
    await user.save();

    // ✅ Send via Nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Support Team" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset Code",
      text: `Your password reset code is: ${resetCode}. It will expire in 5 minutes.`,
    };

    console.log("📨 Sending email to:", email);
    await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully");

    res.status(200).json({ message: "✅ Reset code sent! Please check your email." });
  } catch (err) {
    console.error("❌ Forgot Password Error:", err);
    res.status(500).json({ message: "Failed to send reset code." });
  }
};



// ✅ Reset Password — verify token and update password (supports both code and token)
export const resetPassword = async (req, res) => {
  const { email, code, token, newPassword } = req.body;

  try {
    let user;
    let userType = "user";

    // Support both code-based (6-digit) and token-based (hex) reset
    if (token) {
      // Token-based reset (from admin-initiated reset or new user setup)
      user = await User.findOne({
        email,
        resetPasswordCode: token,
      });

      if (!user) {
        user = await Admin.findOne({
          email,
          resetPasswordCode: token,
        });
        userType = "admin";
      }

      // Check if token is expired
      if (user && user.resetPasswordExpires) {
        const expiresDate = user.resetPasswordExpires instanceof Date 
          ? user.resetPasswordExpires.getTime() 
          : new Date(user.resetPasswordExpires).getTime();
        
        if (expiresDate <= Date.now()) {
          return res.status(400).json({ message: "Token has expired. Please request a new password reset link." });
        }
      }
    } else if (code) {
      // Code-based reset (from forgot password) - check User and Admin
      user = await User.findOne({
        email,
        resetPasswordCode: code,
        resetPasswordExpires: { $gt: Date.now() },
      });
      if (!user) {
        user = await Admin.findOne({
          email,
          resetPasswordCode: code,
          resetPasswordExpires: { $gt: Date.now() },
        });
        userType = "admin";
      }
    } else {
      return res.status(400).json({ message: "Reset code or token is required" });
    }

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset code/token" });
    }

    if (!newPassword) {
      return res.status(400).json({ message: "New password is required" });
    }

    // Enhanced password validation with email
    const validation = validatePassword(newPassword, { email: user.email || email, name: user.name || "" });
    if (!validation.isValid) {
      return res.status(400).json({
        message: "Password does not meet the security requirements.",
        errors: validation.errors,
        details: validation.details,
      });
    }

    // Update password (hashed automatically in User.js pre-save hook)
    user.password = newPassword;
    user.resetPasswordCode = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: "✅ Password has been reset successfully!" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Failed to reset password" });
  }
};

// ✅ Set Password via Token (for new user account setup)
export const setPasswordWithToken = async (req, res) => {
  try {
    const { token, email, newPassword } = req.body;

    if (!token || !email || !newPassword) {
      return res.status(400).json({ message: "Token, email, and new password are required" });
    }

    // Check User collection first
    let user = await User.findOne({
      email,
      resetPasswordCode: token,
    });

    let userType = "user";

    // If not found in User collection, check Admin collection
    if (!user) {
      user = await Admin.findOne({
        email,
        resetPasswordCode: token,
      });
      userType = "admin";
    }

    if (!user) {
      return res.status(400).json({ message: "Invalid token. Please check your email link or contact support." });
    }

    // Enhanced password validation with email
    const validation = validatePassword(newPassword, { email: user.email || email, name: user.name || "" });
    if (!validation.isValid) {
      return res.status(400).json({
        message: "Password does not meet the security requirements.",
        errors: validation.errors,
        details: validation.details,
      });
    }

    // Check if token is expired
    if (user.resetPasswordExpires) {
      const expiresDate = user.resetPasswordExpires instanceof Date 
        ? user.resetPasswordExpires.getTime() 
        : new Date(user.resetPasswordExpires).getTime();
      
      if (expiresDate <= Date.now()) {
        return res.status(400).json({ message: "Token has expired. Please request a new password setup link." });
      }
    }

    // Update password (hashed automatically by pre-save hook)
    user.password = newPassword;
    user.resetPasswordCode = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ 
      message: "✅ Password has been set successfully! You can now login with your new password.",
      userType 
    });
  } catch (err) {
    console.error("Set password error:", err);
    res.status(500).json({ message: "Failed to set password" });
  }
};
