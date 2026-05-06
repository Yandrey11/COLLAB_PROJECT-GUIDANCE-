import College from "../../models/College.js";
import CourseCatalog from "../../models/CourseCatalog.js";
import YearLevelCatalog from "../../models/YearLevelCatalog.js";
import { COUNSELOR_COLLEGES } from "../../utils/counselorColleges.js";

const DEFAULT_YEAR_LEVELS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "5th Year",
  "Graduate",
];

const isNonEmpty = (v) => typeof v === "string" && v.trim() !== "";

const makeCode = (name) =>
  String(name || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);

export async function ensureMasterDataSeeded() {
  const [collegeCount, yearCount] = await Promise.all([
    College.countDocuments(),
    YearLevelCatalog.countDocuments(),
  ]);

  if (collegeCount === 0) {
    const collegeDocs = COUNSELOR_COLLEGES.map((name, idx) => ({
      name,
      code: makeCode(name) || `COLLEGE_${idx + 1}`,
      sortOrder: idx,
      isActive: true,
    }));
    await College.insertMany(collegeDocs, { ordered: false }).catch(() => null);
  }

  if (yearCount === 0) {
    const years = DEFAULT_YEAR_LEVELS.map((label, idx) => ({
      label,
      value: label,
      sortOrder: idx,
      isActive: true,
    }));
    await YearLevelCatalog.insertMany(years, { ordered: false }).catch(() => null);
  }
}

export async function getCatalogOptions() {
  await ensureMasterDataSeeded();

  const [colleges, courses, yearLevels] = await Promise.all([
    College.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    CourseCatalog.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .populate("collegeId", "name code")
      .lean(),
    YearLevelCatalog.find({ isActive: true }).sort({ sortOrder: 1, label: 1 }).lean(),
  ]);

  return {
    colleges: colleges.map((c) => ({
      id: String(c._id),
      name: c.name,
      code: c.code,
    })),
    courses: courses.map((c) => ({
      id: String(c._id),
      name: c.name,
      code: c.code,
      collegeId: c.collegeId?._id ? String(c.collegeId._id) : String(c.collegeId || ""),
      collegeName: c.collegeId?.name || "",
    })),
    yearLevels: yearLevels.map((y) => ({
      id: String(y._id),
      label: y.label,
      value: y.value,
    })),
  };
}

export const getMasterData = async (req, res) => {
  try {
    const options = await getCatalogOptions();
    res.json({ success: true, ...options });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch master data", error: error.message });
  }
};

export const createCollege = async (req, res) => {
  try {
    const { name, code, sortOrder = 0, isActive = true } = req.body || {};
    if (!isNonEmpty(name)) return res.status(400).json({ success: false, message: "College name is required" });
    const doc = await College.create({
      name: name.trim(),
      code: isNonEmpty(code) ? code.trim().toUpperCase() : makeCode(name),
      sortOrder: Number(sortOrder) || 0,
      isActive: Boolean(isActive),
    });
    res.status(201).json({ success: true, college: doc });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create college", error: error.message });
  }
};

export const updateCollege = async (req, res) => {
  try {
    const { id } = req.params;
    const patch = {};
    if (isNonEmpty(req.body?.name)) patch.name = req.body.name.trim();
    if (isNonEmpty(req.body?.code)) patch.code = req.body.code.trim().toUpperCase();
    if (req.body?.sortOrder !== undefined) patch.sortOrder = Number(req.body.sortOrder) || 0;
    if (req.body?.isActive !== undefined) patch.isActive = Boolean(req.body.isActive);
    const updated = await College.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ success: false, message: "College not found" });
    res.json({ success: true, college: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update college", error: error.message });
  }
};

export const deleteCollege = async (req, res) => {
  try {
    const { id } = req.params;
    const hasCourses = await CourseCatalog.exists({ collegeId: id });
    if (hasCourses) {
      return res.status(400).json({ success: false, message: "Cannot delete college with existing courses" });
    }
    const deleted = await College.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: "College not found" });
    res.json({ success: true, message: "College deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete college", error: error.message });
  }
};

export const createCourse = async (req, res) => {
  try {
    const { name, code, collegeId, sortOrder = 0, isActive = true } = req.body || {};
    if (!isNonEmpty(name) || !collegeId) {
      return res.status(400).json({ success: false, message: "Course name and college are required" });
    }
    const college = await College.findById(collegeId);
    if (!college) return res.status(400).json({ success: false, message: "Invalid college" });
    const doc = await CourseCatalog.create({
      name: name.trim(),
      code: isNonEmpty(code) ? code.trim().toUpperCase() : makeCode(name),
      collegeId,
      sortOrder: Number(sortOrder) || 0,
      isActive: Boolean(isActive),
    });
    res.status(201).json({ success: true, course: doc });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create course", error: error.message });
  }
};

export const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const patch = {};
    if (isNonEmpty(req.body?.name)) patch.name = req.body.name.trim();
    if (isNonEmpty(req.body?.code)) patch.code = req.body.code.trim().toUpperCase();
    if (req.body?.collegeId) {
      const college = await College.findById(req.body.collegeId);
      if (!college) return res.status(400).json({ success: false, message: "Invalid college" });
      patch.collegeId = req.body.collegeId;
    }
    if (req.body?.sortOrder !== undefined) patch.sortOrder = Number(req.body.sortOrder) || 0;
    if (req.body?.isActive !== undefined) patch.isActive = Boolean(req.body.isActive);
    const updated = await CourseCatalog.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ success: false, message: "Course not found" });
    res.json({ success: true, course: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update course", error: error.message });
  }
};

export const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await CourseCatalog.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: "Course not found" });
    res.json({ success: true, message: "Course deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete course", error: error.message });
  }
};

export const createYearLevel = async (req, res) => {
  try {
    const { label, value, sortOrder = 0, isActive = true } = req.body || {};
    if (!isNonEmpty(label)) return res.status(400).json({ success: false, message: "Year level label is required" });
    const doc = await YearLevelCatalog.create({
      label: label.trim(),
      value: isNonEmpty(value) ? value.trim() : label.trim(),
      sortOrder: Number(sortOrder) || 0,
      isActive: Boolean(isActive),
    });
    res.status(201).json({ success: true, yearLevel: doc });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create year level", error: error.message });
  }
};

export const updateYearLevel = async (req, res) => {
  try {
    const { id } = req.params;
    const patch = {};
    if (isNonEmpty(req.body?.label)) patch.label = req.body.label.trim();
    if (isNonEmpty(req.body?.value)) patch.value = req.body.value.trim();
    if (req.body?.sortOrder !== undefined) patch.sortOrder = Number(req.body.sortOrder) || 0;
    if (req.body?.isActive !== undefined) patch.isActive = Boolean(req.body.isActive);
    const updated = await YearLevelCatalog.findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ success: false, message: "Year level not found" });
    res.json({ success: true, yearLevel: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update year level", error: error.message });
  }
};

export const deleteYearLevel = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await YearLevelCatalog.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: "Year level not found" });
    res.json({ success: true, message: "Year level deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete year level", error: error.message });
  }
};
