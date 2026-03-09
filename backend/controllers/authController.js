import Counselor from "../models/Counselor.js";
import Admin from "../models/Admin.js";
import GoogleUser from "../models/GoogleUser.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { validatePassword } from "../utils/passwordValidation.js";
import { createSession } from "./admin/sessionController.js";
import { createNotification } from "./admin/notificationController.js";

// ===========================
// 🔹 SIGNUP
// ===========================
export const signupUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // ✅ Check if user already exists (in any collection)
    const existingUser = await Counselor.findOne({ email });
    const existingAdmin = await Admin.findOne({ email });
    const existingGoogleUser = await GoogleUser.findOne({ email });
    if (existingUser || existingAdmin || existingGoogleUser)
      return res.status(400).json({ message: "Email already registered" });

    // ✅ Password strength validation
    const { isValid, errors } = validatePassword(password);
    if (!isValid) {
      return res.status(400).json({
        message: "Password does not meet the security requirements.",
        details: errors,
      });
    }

    // ✅ Create new user (password will be hashed by pre-save hook)
    const newUser = new User({ name, email, password });
    await newUser.save();

    // ✅ Create notification for admin about new account creation
    try {
      await createNotification({
        title: "New Account Created",
        description: `${newUser.name} (${newUser.email}) has created a new account with role: ${newUser.role || "counselor"}`,
        category: "User Activity",
        priority: "medium",
        metadata: {
          userId: newUser._id.toString(),
          userEmail: newUser.email,
          userName: newUser.name,
          userRole: newUser.role || "counselor",
        },
        relatedId: newUser._id.toString(),
        relatedType: "user",
      });
    } catch (notificationError) {
      console.error("⚠️ Notification creation failed (non-critical):", notificationError);
      // Continue with signup even if notification creation fails
    }

    res.status(201).json({
      message: "Signup successful",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (err) {
    console.error("❌ Signup error:", err);
    res.status(500).json({ message: "Server error during signup" });
  }
};

// ===========================
// 🔹 LOGIN
// ===========================
// Helper function to sync Google Calendar tokens from GoogleUser to User based on email
const syncCalendarTokensFromGoogleUser = async (userEmail, userModel) => {
  try {
    const googleUser = await GoogleUser.findOne({ email: userEmail });
    
    if (googleUser && googleUser.googleCalendarAccessToken) {
      // Sync calendar tokens from GoogleUser to User
      userModel.googleCalendarAccessToken = googleUser.googleCalendarAccessToken;
      userModel.googleCalendarRefreshToken = googleUser.googleCalendarRefreshToken;
      userModel.googleCalendarTokenExpires = googleUser.googleCalendarTokenExpires;
      
      // Also link googleId if not already linked
      if (googleUser.googleId && !userModel.googleId) {
        userModel.googleId = googleUser.googleId;
      }
      
      await userModel.save();
      console.log(`✅ Synced Google Calendar tokens for ${userEmail}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`⚠️ Error syncing calendar tokens for ${userEmail}:`, error);
    return false;
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ Find user by email
    const user = await Counselor.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid email or password" });

    // Check if account is active
    if (user.accountStatus === "inactive") {
      return res.status(403).json({ message: "Account is inactive. Please contact an administrator." });
    }

    // ✅ Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid email or password" });

    // ✅ Automatically sync Google Calendar tokens if available
    // Check if user already has calendar tokens, if not, try to sync from GoogleUser
    if (!user.googleCalendarAccessToken) {
      const synced = await syncCalendarTokensFromGoogleUser(email, user);
      if (synced) {
        // Reload user from database to get updated tokens
        const refreshedUser = await Counselor.findById(user._id);
        if (refreshedUser?.googleCalendarAccessToken) {
          console.log(`✅ Google Calendar automatically connected for ${email} based on email match`);
        }
      }
    }

    // ✅ Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // ✅ Create session record
    try {
      await createSession(user, token, req);
    } catch (sessionError) {
      console.error("⚠️ Session creation failed (non-critical):", sessionError);
      // Continue with login even if session creation fails
    }

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
};

// ===========================
// 🔹 GET CURRENT USER (ME)
// ===========================
export const getCurrentUser = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    console.log(`🔍 getCurrentUser: Looking up user with decoded.id: ${decoded.id} (type: ${typeof decoded.id}), email: ${decoded.email}`);

    // ✅ Convert decoded.id to ObjectId if it's a valid MongoDB ObjectId string
    let userIdToSearch = decoded.id;
    if (typeof decoded.id === 'string' && mongoose.Types.ObjectId.isValid(decoded.id)) {
      userIdToSearch = new mongoose.Types.ObjectId(decoded.id);
      console.log(`🔄 Converted string ID to ObjectId: ${userIdToSearch}`);
    }

    // ✅ Try to find user in User collection first
    let user = await Counselor.findById(userIdToSearch).select("-password");
    if (user) {
      console.log(`✅ Found user in User collection: ${user.email}`);
    }
    
    // ✅ If not found, check GoogleUser collection (for Google OAuth users)
    if (!user) {
      console.log(`🔍 User not found in Counselor collection, checking GoogleUser...`);
      let googleUser = await GoogleUser.findById(userIdToSearch);
      
      if (googleUser) {
        console.log(`✅ Found GoogleUser by ID: ${googleUser.email} (ID: ${googleUser._id})`);
      } else {
        // Try with string ID as well
        googleUser = await GoogleUser.findById(decoded.id);
        if (googleUser) {
          console.log(`✅ Found GoogleUser by string ID: ${googleUser.email} (ID: ${googleUser._id})`);
        }
      }
      
      if (googleUser) {
        // Convert GoogleUser to user-like object for compatibility
        user = {
          _id: googleUser._id,
          id: googleUser._id.toString(),
          name: googleUser.name,
          email: googleUser.email,
          role: googleUser.role || "counselor",
          googleId: googleUser.googleId,
          googleCalendarAccessToken: googleUser.googleCalendarAccessToken || null,
          googleCalendarRefreshToken: googleUser.googleCalendarRefreshToken || null,
        };
      } else {
        // Try to find by email as fallback (in case ID format doesn't match)
        if (decoded.email) {
          console.log(`🔍 Trying to find GoogleUser by email: ${decoded.email}`);
          const googleUserByEmail = await GoogleUser.findOne({ email: decoded.email });
          if (googleUserByEmail) {
            console.log(`✅ Found GoogleUser by email: ${googleUserByEmail.email} (ID: ${googleUserByEmail._id})`);
            user = {
              _id: googleUserByEmail._id,
              id: googleUserByEmail._id.toString(),
              name: googleUserByEmail.name,
              email: googleUserByEmail.email,
              role: googleUserByEmail.role || "counselor",
              googleId: googleUserByEmail.googleId,
              googleCalendarAccessToken: googleUserByEmail.googleCalendarAccessToken || null,
              googleCalendarRefreshToken: googleUserByEmail.googleCalendarRefreshToken || null,
            };
          }
        }
        
        if (!user) {
          console.warn(`⚠️ User not found in User or GoogleUser collections with ID: ${decoded.id}`);
          // Log sample GoogleUsers for debugging
          try {
            const allGoogleUsers = await GoogleUser.find({}).select("_id email").limit(5);
            console.log(`📋 Sample GoogleUsers in DB:`, allGoogleUsers.map(u => ({ id: u._id.toString(), email: u.email })));
          } catch (err) {
            console.error("Error fetching sample GoogleUsers:", err);
          }
        }
      }
    }

    if (!user) {
      console.error(`❌ User not found for token. Decoded ID: ${decoded.id}, Decoded email: ${decoded.email}`);
      return res.status(404).json({ message: "User not found", debug: { id: decoded.id, email: decoded.email } });
    }

    // ✅ Auto-sync calendar tokens if user is from User collection (not GoogleUser) and doesn't have tokens
    // Check if user is a Mongoose document (has .save method) or a plain object
    if (user && typeof user.save === 'function' && !user.googleCalendarAccessToken && user.email) {
      await syncCalendarTokensFromGoogleUser(user.email, user);
      // Reload to get updated tokens
      const refreshedUser = await Counselor.findById(decoded.id).select("-password");
      if (refreshedUser?.googleCalendarAccessToken) {
        console.log(`✅ Auto-synced calendar tokens for ${user.email}`);
        user = refreshedUser;
      }
    }

    const isGoogleUser = Boolean(user.googleId);
    const isDriveConnected = Boolean(user.googleCalendarAccessToken || user.googleCalendarRefreshToken);

    res.status(200).json({
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        role: user.role || "counselor",
        googleId: user.googleId || null,
        isGoogleUser,
        isDriveConnected,
      },
    });
  } catch (err) {
    console.error("❌ Get current user error:", err);
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    res.status(500).json({ message: "Server error" });
  }
};
