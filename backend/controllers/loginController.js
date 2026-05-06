import jwt from "jsonwebtoken";
import { createSession } from "./admin/sessionController.js";
import axios from "axios";
import { getFileUrl } from "../middleware/uploadMiddleware.js";
import { findCounselorByEmail, findGoogleUserByEmail } from "../utils/userLookup.js";

const verifyRecaptcha = async (token) => {
  if (!token) return false;

  try {
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) return false;

    const { data } = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify",
      null,
      { params: { secret, response: token } }
    );

    return data.success === true;
  } catch (error) {
    console.error("❌ reCAPTCHA verification error:", error.response?.data || error.message);
    return false;
  }
};

export const login = async (req, res) => {
  try {
    const { email, password, recaptchaToken } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const captchaValid = await verifyRecaptcha(recaptchaToken);
    if (!captchaValid) {
      return res.status(400).json({ message: "reCAPTCHA verification failed" });
    }

    // ✅ Check if user exists in User collection (for email/password login)
    let user = await findCounselorByEmail(email);

    // ✅ If not found in User collection, check if they're a Google-only user
    if (!user) {
      const googleUser = await findGoogleUserByEmail(email);
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

    const baseUrl =
      process.env.API_URL || process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
    const rawPicture = user.profilePicture ?? null;
    const profilePicture = rawPicture ? getFileUrl(rawPicture, baseUrl) : null;

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        college: user.college ?? null,
        profilePicture,
      },
    });
  } catch (error) {
    console.error("❌ Login Error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
};
