import mongoose from "mongoose";
import encryptedFieldsPlugin from "../utils/encryptedFieldsPlugin.js";

const googleUserSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true },
    name: String,
    email: { type: String },
    role: {
      type: String,
      enum: ["counselor", "admin"],
      default: "counselor",
    },
    googleCalendarAccessToken: { type: String },
    googleCalendarRefreshToken: { type: String },
    googleCalendarTokenExpires: { type: Date },
    profilePicture: { type: String, default: null },
    /** BuKSU college (same allowed list as Counselor); set at profile or admin */
    college: { type: String, default: null },
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
  { timestamps: true }
);

// ✅ Helper method to check permission
googleUserSchema.methods.hasPermission = function (permission) {
  // Admins have all permissions
  if (this.role === "admin" || this.permissions?.is_admin) {
    return true;
  }
  return this.permissions?.[permission] === true;
};

googleUserSchema.plugin(encryptedFieldsPlugin, {
  fields: ["name", "email", "phoneNumber", "bio", "profilePicture"],
  lookups: {
    emailLookup: { from: "email", normalize: "email", unique: true },
    nameLookup: { from: "name", normalize: "name" },
  },
});

// ✅ Set is_admin based on role for backwards compatibility
googleUserSchema.pre("save", async function (next) {
  if (this.role === "admin") {
    if (!this.permissions) {
      this.permissions = {};
    }
    this.permissions.is_admin = true;
  }
  next();
});

export default mongoose.model("GoogleUser", googleUserSchema);
