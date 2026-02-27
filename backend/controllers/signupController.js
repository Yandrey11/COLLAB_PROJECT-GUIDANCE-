import Counselor from "../models/Counselor.js";
import Admin from "../models/Admin.js";
import GoogleUser from "../models/GoogleUser.js";
import jwt from "jsonwebtoken";
import { validatePassword } from "../utils/passwordValidation.js";

export const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
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

    // Check if email already exists
    const existingUser = await Counselor.findOne({ email });
    const existingAdmin = await Admin.findOne({ email });
    const existingGoogleUser = await GoogleUser.findOne({ email });
    if (existingUser || existingAdmin || existingGoogleUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Create new user (password automatically hashed via pre-save)
    const newUser = new Counselor({ name, email, password });
    await newUser.save();

    // Generate JWT token
    const token = jwt.sign(
      { id: newUser._id, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(201).json({
      message: "Signup successful",
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("❌ Signup Error:", error);
    res.status(500).json({ message: "Server error during signup" });
  }
};
