import Counselor from "../models/Counselor.js";
import GoogleUser from "../models/GoogleUser.js";
import jwt from "jsonwebtoken";
import { createSession } from "./admin/sessionController.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    // ✅ Check if user exists in User collection (for email/password login)
    let user = await Counselor.findOne({ email });

    // ✅ If not found in User collection, check if they're a Google-only user
    if (!user) {
      const googleUser = await GoogleUser.findOne({ email });
      if (googleUser) {
        // User exists but only in GoogleUser (no password set)
        return res.status(400).json({ 
          message: "This account was created with Google. Please sign in with Google instead." 
        });
      }
      // User doesn't exist in either collection
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check if account is active
    if (user.accountStatus === "inactive") {
      return res.status(403).json({ message: "Account is inactive. Please contact an administrator." });
    }

    // ✅ Compare entered password with stored hash
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // ✅ Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
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
  } catch (error) {
    console.error("❌ Login Error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
};
