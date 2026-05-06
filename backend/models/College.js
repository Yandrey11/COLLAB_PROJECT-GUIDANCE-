import mongoose from "mongoose";

const collegeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

collegeSchema.index({ isActive: 1, sortOrder: 1, name: 1 });

const College = mongoose.models.College || mongoose.model("College", collegeSchema);

export default College;
