import Admin from "../../models/Admin.js";
import jwt from "jsonwebtoken";
import { validatePassword } from "../../utils/passwordValidation.js";
import {
  findAdminByEmail,
  findCounselorByEmail,
  findGoogleUserByEmail,
} from "../../utils/userLookup.js";

const parseBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
};

const canBootstrapAdmin = (req) => {
  const allowBootstrap = parseBool(process.env.ALLOW_ADMIN_BOOTSTRAP, false);
  const configuredSecret = String(process.env.ADMIN_BOOTSTRAP_SECRET || "").trim();
  const providedSecret =
    String(req.headers["x-admin-bootstrap-secret"] || req.body?.bootstrapSecret || "").trim();

  if (!allowBootstrap || !configuredSecret) return false;
  return providedSecret.length > 0 && providedSecret === configuredSecret;
};

const isExistingAdminRequest = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded?.role !== "admin") return false;
    const admin = await Admin.findById(decoded.id).select("_id role permissions");
    return !!admin && (admin.role === "admin" || admin.permissions?.is_admin === true);
  } catch {
    return false;
  }
};

// ADMIN SIGNUP (no reCAPTCHA)
export const adminSignup = async (req, res) => {
  try {
    const [existingAdminRequest, adminCount] = await Promise.all([
      isExistingAdminRequest(req),
      Admin.countDocuments(),
    ]);
    const bootstrapAllowed = canBootstrapAdmin(req);
    const isFirstAdminBootstrap = adminCount === 0 && bootstrapAllowed;

    if (!existingAdminRequest && !isFirstAdminBootstrap) {
      return res.status(403).json({
        message:
          "Admin signup is restricted. Use bootstrap secret for first admin or an authenticated admin account.",
      });
    }

    const { name, email, password } = req.body;

    const existingAdmin = await findAdminByEmail(email);
    const existingUser = await findCounselorByEmail(email);
    const existingGoogleUser = await findGoogleUserByEmail(email);
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
