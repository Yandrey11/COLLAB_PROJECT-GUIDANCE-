import express from "express";
import jwt from "jsonwebtoken";
import Counselor from "../../models/Counselor.js";

const router = express.Router();

/**
 * @route POST /api/admin/refresh-token
 * @desc Refresh admin access token using a valid refresh token
 */
router.post("/refresh-token", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(401).json({ message: "No refresh token provided" });

    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    const admin = await Counselor.findById(decoded.id);
    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    // Optional: compare refreshToken stored in DB
    if (admin.refreshToken !== refreshToken) {
      return res.status(403).json({ message: "Token mismatch or expired" });
    }

    // ✅ Create new access token
    const newAccessToken = jwt.sign(
      {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    console.log(`♻️  New access token issued for admin: ${admin.email}`);

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error("❌ Refresh token error:", err.message);
    res.status(403).json({ message: "Invalid or expired refresh token" });
  }
});

export default router;
