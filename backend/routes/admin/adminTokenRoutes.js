// routes/admin/adminTokenRoutes.js
import express from "express";
import jwt from "jsonwebtoken";
import User from "../../models/Admin.js";

const router = express.Router();
const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.REFRESH_TOKEN_SECRET;

export const handleAdminRefresh = async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!refreshToken) return res.status(401).json({ message: "No refresh token" });

  try {
    if (!refreshSecret) {
      return res.status(500).json({ message: "Refresh token secret is not configured" });
    }
    const decoded = jwt.verify(refreshToken, refreshSecret);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const newAccessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.cookie("accessToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 15 * 60 * 1000,
    });

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error("Refresh error:", err);
    res.status(403).json({ message: "Invalid refresh token" });
  }
};

router.post("/refresh", handleAdminRefresh);

export default router;
