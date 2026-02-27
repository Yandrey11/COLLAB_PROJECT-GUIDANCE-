import mongoose from "mongoose";

const adminReportSchema = new mongoose.Schema(
  {
    reportName: {
      type: String,
      required: true,
    },
    reportType: {
      type: String,
      required: true,
      enum: [
        "Counseling Records Report",
        "Counselor Activity Report",
        "Generated Files Report",
        "User Account Report",
        "System Logs Report",
      ],
    },
    trackingNumber: {
      type: String,
      required: true,
      unique: true,
    },
    generatedBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: "generatedBy.userModel",
      },
      userName: { type: String, required: true },
      userEmail: { type: String, required: true },
      userModel: {
        type: String,
        required: true,
        enum: ["Admin", "Counselor"],
      },
    },
    // Filter criteria used to generate the report
    filterCriteria: {
      clientName: { type: String },
      counselorName: { type: String },
      status: { type: String },
      recordType: { type: String },
      sessionType: { type: String },
      startDate: { type: Date },
      endDate: { type: Date },
      counselorId: { type: mongoose.Schema.Types.ObjectId },
    },
    // Statistics for the report
    statistics: {
      totalRecords: { type: Number, default: 0 },
      completedSessions: { type: Number, default: 0 },
      ongoingSessions: { type: Number, default: 0 },
      referredSessions: { type: Number, default: 0 },
      totalCounselors: { type: Number, default: 0 },
      totalPDFs: { type: Number, default: 0 },
      totalDriveUploads: { type: Number, default: 0 },
      totalUsers: { type: Number, default: 0 },
    },
    // Google Drive information
    driveFileId: { type: String },
    driveLink: { type: String },
    driveUploadStatus: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    driveUploadError: { type: String },
    // File information
    fileName: { type: String },
    fileSize: { type: Number }, // in bytes
    // Report data (can store summary or reference IDs)
    reportData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Activity tracking
    viewCount: { type: Number, default: 0 },
    downloadCount: { type: Number, default: 0 },
    lastViewedAt: { type: Date },
    lastDownloadedAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes for better query performance
adminReportSchema.index({ reportType: 1, createdAt: -1 });
adminReportSchema.index({ "generatedBy.userId": 1, createdAt: -1 });
adminReportSchema.index({ createdAt: -1 });

const AdminReport =
  mongoose.models.AdminReport || mongoose.model("AdminReport", adminReportSchema);

export default AdminReport;

