import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { streamUploadFile } from "../controllers/uploadAccessController.js";

const router = express.Router();

/**
 * Authenticated streaming endpoint for uploads.
 * Example:
 *   GET /api/uploads/profiles/file.png
 */
router.get("/*path", protect, streamUploadFile);

export default router;

