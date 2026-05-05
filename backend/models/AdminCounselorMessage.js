import mongoose from "mongoose";

const adminCounselorMessageSchema = new mongoose.Schema(
  {
    counselorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Counselor",
      required: true,
      index: true,
    },
    senderRole: {
      type: String,
      enum: ["counselor", "admin"],
      required: true,
    },
    senderUserId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    /** Set when the recipient side has seen the message (admin team or counselor). */
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

adminCounselorMessageSchema.index({ counselorId: 1, createdAt: -1 });
adminCounselorMessageSchema.index({ counselorId: 1, senderRole: 1, readAt: 1 });

const AdminCounselorMessage =
  mongoose.models.AdminCounselorMessage ||
  mongoose.model("AdminCounselorMessage", adminCounselorMessageSchema);

export default AdminCounselorMessage;
