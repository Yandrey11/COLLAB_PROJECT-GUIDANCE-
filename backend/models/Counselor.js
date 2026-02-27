import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const counselorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["counselor", "admin"],
      default: "counselor",
    },
    accountStatus: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    googleId: { type: String },
    resetPasswordCode: { type: String },
    resetPasswordExpires: { type: Date },
    googleCalendarAccessToken: { type: String },
    googleCalendarRefreshToken: { type: String },
    googleCalendarTokenExpires: { type: Date },
    profilePicture: { type: String, default: null },
    phoneNumber: { type: String },
    bio: { type: String, maxLength: 500 },
    // RBAC Permissions
    permissions: {
      can_view_records: { type: Boolean, default: true },
      can_edit_records: { type: Boolean, default: true },
      can_view_reports: { type: Boolean, default: true },
      can_generate_reports: { type: Boolean, default: false },
      is_admin: { type: Boolean, default: false },
    },
  },
  { timestamps: true, collection: "users" }
);

// ✅ Hash password ONLY if modified and not already hashed
counselorSchema.pre("save", async function (next) {
  // Set permissions based on role
  if (this.role === "admin") {
    if (!this.permissions) {
      this.permissions = {};
    }
    this.permissions.is_admin = true;
  }

  // Set default permissions for new counselors if not set
  if (this.isNew && !this.permissions) {
    this.permissions = {
      can_view_records: true,
      can_edit_records: true,
      can_view_reports: true,
      can_generate_reports: false,
      is_admin: this.role === "admin",
    };
  }

  // Hash password if modified
  if (!this.isModified("password")) return next();

  // Safeguard: Check if password is already hashed (starts with bcrypt hash prefix)
  // This prevents double-hashing if an already-hashed password is accidentally passed
  if (this.password && (this.password.startsWith("$2a$") || this.password.startsWith("$2b$") || this.password.startsWith("$2y$"))) {
    console.warn("⚠️ Password appears to be already hashed, skipping hash operation");
    return next();
  }

  console.log("🔒 Hashing password for:", this.email);
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ✅ Compare password for login
counselorSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ✅ Helper method to check permission
counselorSchema.methods.hasPermission = function (permission) {
  // Admins have all permissions
  if (this.role === "admin" || this.permissions?.is_admin) {
    return true;
  }
  return this.permissions?.[permission] === true;
};

// ✅ Prevent OverwriteModelError (keep "users" collection for backward compatibility)
const Counselor = mongoose.models.Counselor || mongoose.model("Counselor", counselorSchema);

export default Counselor;
