import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actorAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "actorModel",
    },
    actorModel: {
      type: String,
      required: true,
      enum: ["Admin", "Counselor"],
    },
    actorName: {
      type: String,
      required: true,
    },
    actorEmail: {
      type: String,
      required: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "targetModel",
    },
    targetModel: {
      type: String,
      required: true,
      enum: ["Counselor", "GoogleUser", "Admin"],
    },
    targetUserName: {
      type: String,
      required: true,
    },
    targetUserEmail: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: ["permission_update", "permission_grant", "permission_revoke", "user_create", "user_update", "user_delete"],
    },
    changedPermissions: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // Format: { permissionName: { from: boolean, to: boolean } }
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Indexes for faster queries
auditLogSchema.index({ actorAdminId: 1, createdAt: -1 });
auditLogSchema.index({ targetUserId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;


