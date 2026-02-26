import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: "admin" },
    googleId: { type: String, sparse: true }, // For Google OAuth; allows manual login with same email
    googleCalendarAccessToken: { type: String },
    googleCalendarRefreshToken: { type: String },
    googleCalendarTokenExpires: { type: Date },
    resetPasswordCode: { type: String },
    resetPasswordExpires: { type: Date },
    // Profile fields
    profilePicture: { type: String, default: null },
    phoneNumber: { type: String },
    bio: { type: String, maxLength: 500 },
    // Settings fields
    settings: {
      display: {
        theme: { type: String, enum: ["light", "dark"], default: "light" },
        uiDensity: { type: String, enum: ["compact", "normal"], default: "normal" },
        defaultDashboardView: { type: String, enum: ["users", "records", "notifications", "analytics"], default: "records" },
      },
      notifications: {
        newUserCreations: { type: Boolean, default: true },
        recordUpdates: { type: Boolean, default: true },
        criticalSystemAlerts: { type: Boolean, default: true },
        pdfGenerations: { type: Boolean, default: true },
        loginAttempts: { type: Boolean, default: false },
        soundEnabled: { type: Boolean, default: false },
      },
      privacy: {
        hideProfilePhoto: { type: Boolean, default: false },
        maskNameInNotifications: { type: Boolean, default: false },
      },
    },
    // RBAC Permissions - Admins have all permissions by default
    permissions: {
      can_view_records: { type: Boolean, default: true },
      can_edit_records: { type: Boolean, default: true },
      can_view_reports: { type: Boolean, default: true },
      can_generate_reports: { type: Boolean, default: true },
      is_admin: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

// ✅ Hash password before saving (only if not already hashed)
adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  // Safeguard: Check if password is already hashed (starts with bcrypt hash prefix)
  // This prevents double-hashing if an already-hashed password is accidentally passed
  if (this.password && (this.password.startsWith("$2a$") || this.password.startsWith("$2b$") || this.password.startsWith("$2y$"))) {
    console.warn("⚠️ Password appears to be already hashed, skipping hash operation");
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ✅ Compare passwords
adminSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ✅ Helper method to check permission (admins always have all permissions)
adminSchema.methods.hasPermission = function (permission) {
  return true; // Admins have all permissions
};

// ✅ Ensure admin permissions are set correctly
adminSchema.pre("save", async function (next) {
  if (!this.permissions) {
    this.permissions = {};
  }
  this.permissions.is_admin = true;
  this.permissions.can_view_records = true;
  this.permissions.can_edit_records = true;
  this.permissions.can_view_reports = true;
  this.permissions.can_generate_reports = true;
  next();
});

const Admin = mongoose.model("Admin", adminSchema);
export default Admin;
