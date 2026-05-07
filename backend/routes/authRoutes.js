import express from "express";
import { signup } from "../controllers/signupController.js";
import { login } from "../controllers/loginController.js";
import { logout } from "../controllers/logoutController.js";
import { getCurrentUser } from "../controllers/authController.js";
import { authLimiter, strictAuthLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();

router.post("/signup", authLimiter, signup);
router.post("/login", strictAuthLimiter, login);
router.post("/logout", authLimiter, logout);
router.get("/me", getCurrentUser); // Get current authenticated user

export default router;
