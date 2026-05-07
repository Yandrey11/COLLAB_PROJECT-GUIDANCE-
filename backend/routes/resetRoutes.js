import express from "express";
import { forgotPassword, resetPassword, setPasswordWithToken } from "../controllers/resetController.js";
import { authLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();

router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPassword);
router.post("/set-password", authLimiter, setPasswordWithToken);

export default router;
