import mongoose from "mongoose";

const recordSchema = new mongoose.Schema(
  {
    clientName: { type: String, required: true },
    date: { type: Date, default: Date.now },
    sessionType: { type: String, required: true },
    sessionNumber: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ["Ongoing", "Completed", "Referred"],
      default: "Ongoing",
    },
    notes: { type: String },
    outcomes: { type: String },
    driveLink: { type: String },
    googleCalendarEventId: { type: String }, // Links record to Google Calendar event
    counselor: { type: String, required: true },
    
    // File attachments
    attachments: [
      {
        fileName: { type: String, required: true },
        fileUrl: { type: String, required: true },
        fileType: { type: String },
        fileSize: { type: Number }, // in bytes
        uploadedBy: { type: String },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    
    // Audit trail
    auditTrail: {
      createdBy: {
        userId: { type: mongoose.Schema.Types.ObjectId },
        userName: { type: String },
        userRole: { type: String },
      },
      createdAt: { type: Date, default: Date.now },
      lastModifiedBy: {
        userId: { type: mongoose.Schema.Types.ObjectId },
        userName: { type: String },
        userRole: { type: String },
      },
      lastModifiedAt: { type: Date, default: Date.now },
      modificationHistory: [
        {
          field: { type: String },
          oldValue: { type: mongoose.Schema.Types.Mixed },
          newValue: { type: mongoose.Schema.Types.Mixed },
          changedBy: {
            userId: { type: mongoose.Schema.Types.ObjectId },
            userName: { type: String },
            userRole: { type: String },
          },
          changedAt: { type: Date, default: Date.now },
        },
      ],
      deletedAt: { type: Date },
      deletedBy: {
        userId: { type: mongoose.Schema.Types.ObjectId },
        userName: { type: String },
        userRole: { type: String },
      },
    },
  },
  { timestamps: true }
);

// Indexes for better query performance
recordSchema.index({ clientName: 1 });
recordSchema.index({ counselor: 1 });
recordSchema.index({ status: 1 });
recordSchema.index({ sessionType: 1 });
recordSchema.index({ date: -1 });
recordSchema.index({ "auditTrail.createdAt": -1 });
recordSchema.index({ "auditTrail.lastModifiedAt": -1 });

// ✅ Prevent OverwriteModelError when models are imported multiple times
const Record = mongoose.models.Record || mongoose.model("Record", recordSchema);

export default Record;
