import Admin from "../../models/Admin.js";
import Counselor from "../../models/Counselor.js";
import GoogleUser from "../../models/GoogleUser.js";
import jwt from "jsonwebtoken";
import { validatePassword } from "../../utils/passwordValidation.js";

// ADMIN SIGNUP (no reCAPTCHA)
export const adminSignup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingAdmin = await Admin.findOne({ email });
    const existingUser = await Counselor.findOne({ email });
    const existingGoogleUser = await GoogleUser.findOne({ email });
    if (existingAdmin || existingUser || existingGoogleUser) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // Enhanced password validation with email and name
    const validation = validatePassword(password, { email, name });
    if (!validation.isValid) {
      return res.status(400).json({
        message: "Password does not meet the security requirements.",
        errors: validation.errors,
        details: validation.details,
      });
    }

    const admin = await Admin.create({ name, email, password });

    // Generate JWT token for automatic login after signup
    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(201).json({
      message: "✅ Admin account created successfully",
      token, // Return token for automatic login
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("❌ Admin Signup Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
