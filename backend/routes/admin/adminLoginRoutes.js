import express from "express";
import { adminLogin } from "../../controllers/admin/adminLoginController.js";
import { strictAuthLimiter } from "../../middleware/rateLimitMiddleware.js";

const router = express.Router();

router.post("/login", strictAuthLimiter, adminLogin);

export default router;
