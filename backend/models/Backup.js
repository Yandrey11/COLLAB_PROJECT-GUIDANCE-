import mongoose from "mongoose";

const backupSchema = new mongoose.Schema(
  {
    backupId: {
      type: String,
      required: true,
      unique: true,
    },
    backupName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "success", "failed"],
      default: "pending",
    },
    createdBy: {
      adminId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: "createdBy.adminModel",
      },
      adminModel: {
        type: String,
        enum: ["Admin", "Counselor"],
        default: "Admin",
      },
      adminName: { type: String, required: true },
      adminEmail: { type: String, required: true },
    },
    backupSize: {
      type: Number, // Size in bytes
      default: 0,
    },
    recordCount: {
      type: Number,
      default: 0,
    },
    userCount: {
      type: Number,
      default: 0,
    },
    adminCount: {
      type: Number,
      default: 0,
    },
    reportCount: {
      type: Number,
      default: 0,
    },
    notificationCount: {
      type: Number,
      default: 0,
    },
    activityLogCount: {
      type: Number,
      default: 0,
    },
    auditLogCount: {
      type: Number,
      default: 0,
    },
    errorMessage: {
      type: String,
    },
    collections: {
      type: [String], // List of collections backed up
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    restoredAt: {
      type: Date,
    },
    restoredBy: {
      adminId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "restoredBy.adminModel",
      },
      adminModel: {
        type: String,
        enum: ["Admin", "Counselor"],
      },
      adminName: { type: String },
      adminEmail: { type: String },
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
// Note: backupId already has an index from unique: true
backupSchema.index({ status: 1, createdAt: -1 });
backupSchema.index({ "createdBy.adminId": 1, createdAt: -1 });
backupSchema.index({ createdAt: -1 });

const Backup = mongoose.models.Backup || mongoose.model("Backup", backupSchema);

export default Backup;

