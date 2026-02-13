import mongoose from "mongoose";

const lockAuditLogSchema = new mongoose.Schema(
  {
    recordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Record",
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ["LOCK", "UNLOCK", "UPDATE", "LOCK_ATTEMPT_BLOCKED", "EDIT_ATTEMPT_BLOCKED", "LOCK_EXPIRED"],
      required: true,
    },
    performedBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      userName: {
        type: String,
        required: true,
      },
      userRole: {
        type: String,
        enum: ["admin", "counselor"],
        required: true,
      },
      userEmail: {
        type: String,
        required: true,
      },
    },
    lockOwner: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
      },
      userName: {
        type: String,
      },
      userRole: {
        type: String,
        enum: ["admin", "counselor"],
      },
    },
    reason: {
      type: String,
      // e.g., "Record locked by another user", "Lock expired", etc.
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Indexes for efficient querying
lockAuditLogSchema.index({ recordId: 1, createdAt: -1 });
lockAuditLogSchema.index({ "performedBy.userId": 1, createdAt: -1 });
lockAuditLogSchema.index({ action: 1, createdAt: -1 });
lockAuditLogSchema.index({ createdAt: -1 });

const LockAuditLog =
  mongoose.models.LockAuditLog || mongoose.model("LockAuditLog", lockAuditLogSchema);

export default LockAuditLog;

