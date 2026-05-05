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
    /** Demographics & case details (optional; clientName/date/sessionNumber/sessionType still core) */
    schoolYear: { type: String },
    gender: { type: String },
    course: { type: String },
    yearLevel: { type: String },
    section: { type: String },
    /** Taxonomy codes (HF, STR, …); validated on write in recordController */
    problemsPresentedCodes: {
      type: [String],
      default: [],
    },
    /** Free-text notes or legacy text not mapped to a code */
    problemsPresentedNotes: { type: String, default: "" },
    /** Denormalized: comma-separated codes + optional notes (kept for PDFs / older clients) */
    problemsPresented: { type: String },
    remarks: { type: String },
    /** Set by administrators (optional) */
    recommendation: { type: String },
    /** Name shown on PDF above the Director, SWEU signature line (last editor of recommendation) */
    recommendationAuthorName: { type: String },
    driveLink: { type: String },
    googleCalendarEventId: { type: String }, // Links record to Google Calendar event
    counselor: { type: String, required: true },

    /** Counselor archive: hidden from default lists; purged after `archivePurgeAt`. */
    archivedAt: { type: Date, default: null },
    archivePurgeAt: { type: Date, default: null },
    archivedBy: {
      userId: { type: mongoose.Schema.Types.ObjectId },
      userName: { type: String },
      userRole: { type: String },
    },

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
recordSchema.index({ archivePurgeAt: 1 });
recordSchema.index({ archivedAt: 1 });

// ✅ Prevent OverwriteModelError when models are imported multiple times
const Record = mongoose.models.Record || mongoose.model("Record", recordSchema);

export default Record;
