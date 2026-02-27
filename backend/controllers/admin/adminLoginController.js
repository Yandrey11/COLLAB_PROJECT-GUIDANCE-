import jwt from "jsonwebtoken";
import Admin from "../../models/Admin.js";
import Counselor from "../../models/Counselor.js";
import GoogleUser from "../../models/GoogleUser.js";
import axios from "axios";

// ✅ Verify Google reCAPTCHA helper
const verifyRecaptcha = async (token) => {
  try {
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    const { data } = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`
    );
    return data.success;
  } catch (error) {
    console.error("❌ reCAPTCHA verification error:", error.response?.data || error.message);
    return false;
  }
};

// 🟦 ADMIN LOGIN (with reCAPTCHA)
export const adminLogin = async (req, res) => {
  try {
    const { email, password, captchaToken } = req.body;

    // ✅ Verify reCAPTCHA
    const captchaValid = await verifyRecaptcha(captchaToken);
    if (!captchaValid) {
      return res.status(400).json({ message: "reCAPTCHA verification failed" });
    }

    // Check in Admin collection first
    let admin = await Admin.findOne({ email });
    let accountType = "admin";

    // If not found in Admin collection, check User collection for admin role
    if (!admin) {
      const user = await Counselor.findOne({ email });
      
      if (user && user.role === "admin") {
        // User has admin role, treat as admin
        admin = {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          matchPassword: user.matchPassword.bind(user),
        };
        accountType = "user";
      }
    }

    if (!admin) {
      // Check if GoogleUser with admin role exists (Google-only admin)
      const googleAdmin = await GoogleUser.findOne({ email, role: "admin" });
      if (googleAdmin) {
        return res.status(400).json({
          message: "This account uses Google sign-in. Sign in with Google above, or use Forgot Password to set a password for manual login.",
        });
      }
      return res.status(404).json({ message: "Admin not found" });
    }

    const isMatch = await admin.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: admin._id, role: admin.role || "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      message: "✅ Login successful",
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role || "admin",
      },
    });
  } catch (error) {
    console.error("❌ Admin Login Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
