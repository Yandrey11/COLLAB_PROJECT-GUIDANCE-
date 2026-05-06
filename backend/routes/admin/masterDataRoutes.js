import express from "express";
import { protectAdmin } from "../../middleware/admin/adminMiddleware.js";
import {
  getMasterData,
  createCollege,
  updateCollege,
  deleteCollege,
  createCourse,
  updateCourse,
  deleteCourse,
  createYearLevel,
  updateYearLevel,
  deleteYearLevel,
} from "../../controllers/admin/masterDataController.js";

const router = express.Router();

router.use(protectAdmin);

router.get("/master-data", getMasterData);

router.post("/master-data/colleges", createCollege);
router.put("/master-data/colleges/:id", updateCollege);
router.delete("/master-data/colleges/:id", deleteCollege);

router.post("/master-data/courses", createCourse);
router.put("/master-data/courses/:id", updateCourse);
router.delete("/master-data/courses/:id", deleteCourse);

router.post("/master-data/year-levels", createYearLevel);
router.put("/master-data/year-levels/:id", updateYearLevel);
router.delete("/master-data/year-levels/:id", deleteYearLevel);

export default router;
