import express from "express";
import {
  getProfile,
  updateProfile,
  changePassword,
  handleProfilePictureUpload,
  removeProfilePicture,
  getActivityLogs,
} from "../controllers/profileController.js";
import { protect } from "../middleware/authMiddleware.js";
import { uploadProfilePicture as uploadMiddleware } from "../middleware/uploadMiddleware.js";
import { sensitiveWriteLimiter, uploadLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();

// All routes require authentication and counselor role check
// Role check is done inside controllers to ensure only counselors can access

/**
 * @route   GET /api/profile
 * @desc    Get counselor profile
 * @access  Private (Counselor only)
 */
router.get("/", protect, getProfile);

/**
 * @route   PUT /api/profile
 * @desc    Update counselor profile
 * @access  Private (Counselor only)
 */
router.put("/", sensitiveWriteLimiter, protect, updateProfile);

/**
 * @route   POST /api/profile/password
 * @desc    Change password
 * @access  Private (Counselor only)
 */
router.post("/password", sensitiveWriteLimiter, protect, changePassword);

/**
 * @route   POST /api/profile/picture
 * @desc    Upload profile picture
 * @access  Private (Counselor only)
 */
router.post("/picture", uploadLimiter, protect, uploadMiddleware, handleProfilePictureUpload);

/**
 * @route   DELETE /api/profile/picture
 * @desc    Remove profile picture
 * @access  Private (Counselor only)
 */
router.delete("/picture", sensitiveWriteLimiter, protect, removeProfilePicture);

/**
 * @route   GET /api/profile/activity
 * @desc    Get activity logs
 * @access  Private (Counselor only)
 */
router.get("/activity", protect, getActivityLogs);

export default router;

