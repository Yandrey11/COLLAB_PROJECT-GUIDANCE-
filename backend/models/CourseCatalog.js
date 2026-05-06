import mongoose from "mongoose";

const courseCatalogSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "College",
      required: true,
      index: true,
    },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

courseCatalogSchema.index({ code: 1, collegeId: 1 }, { unique: true });
courseCatalogSchema.index({ isActive: 1, sortOrder: 1, name: 1 });

const CourseCatalog =
  mongoose.models.CourseCatalog || mongoose.model("CourseCatalog", courseCatalogSchema);

export default CourseCatalog;
