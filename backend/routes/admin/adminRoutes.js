import express from "express";
import { adminLogin } from "../../controllers/admin/adminLoginController.js";
import { getSummary } from "../../controllers/admin/summaryController.js";

import { protectAdmin } from "../../middleware/admin/adminMiddleware.js";

const router = express.Router();

router.post("/login", adminLogin);

// ✅ Protected example route
router.get("/dashboard", protectAdmin, (req, res) => {
  res.json({
    message: `Welcome Admin ${req.admin.name}`,
    email: req.admin.email,
    role: req.admin.role,
    name: req.admin.name,
  });
});

// ✅ Summary endpoint
router.get("/summary", protectAdmin, getSummary);

export default router;
