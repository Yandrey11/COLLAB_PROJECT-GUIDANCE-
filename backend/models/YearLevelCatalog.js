import mongoose from "mongoose";

const yearLevelCatalogSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, unique: true },
    value: { type: String, required: true, trim: true, unique: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

yearLevelCatalogSchema.index({ isActive: 1, sortOrder: 1, label: 1 });

const YearLevelCatalog =
  mongoose.models.YearLevelCatalog ||
  mongoose.model("YearLevelCatalog", yearLevelCatalogSchema);

export default YearLevelCatalog;
