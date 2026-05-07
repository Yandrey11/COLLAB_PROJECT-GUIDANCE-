import express from "express";
import { handleAdminRefresh } from "./adminTokenRoutes.js";

const router = express.Router();

/**
 * @route POST /api/admin/refresh-token
 * @desc Deprecated alias. Use POST /api/admin/refresh
 */
router.post("/refresh-token", (req, res) => {
  res.setHeader("X-Deprecated-Endpoint", "Use /api/admin/refresh");
  res.setHeader("Warning", '299 - "Deprecated endpoint: use POST /api/admin/refresh"');
  return handleAdminRefresh(req, res);
});

export default router;
