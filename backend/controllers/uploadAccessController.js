import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Counselor from "../models/Counselor.js";
import GoogleUser from "../models/GoogleUser.js";
import Admin from "../models/Admin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(path.join(__dirname, "..", "uploads"));

const canAccessProfileFile = async (req, requestedFilename) => {
  const role = req.user?.role || req.admin?.role;
  if (role === "admin") return true;

  const requesterId = req.user?._id || req.admin?._id;
  if (!requesterId) return false;

  const [counselor, googleUser, admin] = await Promise.all([
    Counselor.findById(requesterId).select("profilePicture").lean(),
    GoogleUser.findById(requesterId).select("profilePicture").lean(),
    Admin.findById(requesterId).select("profilePicture").lean(),
  ]);
  const profilePath = counselor?.profilePicture || googleUser?.profilePicture || admin?.profilePicture;
  if (!profilePath) return false;

  return path.basename(profilePath) === requestedFilename;
};

/**
 * GET /api/uploads/*path
 * Authenticated upload file streaming with path traversal protection.
 */
export const streamUploadFile = async (req, res) => {
  try {
    const paramPath = req.params.path;
    const rawPath = Array.isArray(paramPath) ? paramPath.join("/") : paramPath;
    if (!rawPath || typeof rawPath !== "string") {
      return res.status(400).json({ success: false, message: "File path is required." });
    }

    const decodedPath = decodeURIComponent(rawPath);
    const safeSegments = decodedPath.split("/").filter(Boolean);
    if (safeSegments.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid file path." });
    }

    const candidatePath = path.resolve(path.join(uploadsRoot, ...safeSegments));
    if (!candidatePath.startsWith(uploadsRoot + path.sep) && candidatePath !== uploadsRoot) {
      return res.status(403).json({ success: false, message: "Forbidden file path." });
    }

    if (!fs.existsSync(candidatePath)) {
      return res.status(404).json({ success: false, message: "File not found." });
    }

    // Restrict profile image access to owner (or admin).
    if (safeSegments[0] === "profiles") {
      const requestedFilename = safeSegments[safeSegments.length - 1];
      const allowed = await canAccessProfileFile(req, requestedFilename);
      if (!allowed) {
        return res.status(403).json({ success: false, message: "Forbidden file access." });
      }
    }

    const stat = fs.statSync(candidatePath);
    if (!stat.isFile()) {
      return res.status(404).json({ success: false, message: "File not found." });
    }

    const ext = path.extname(candidatePath).toLowerCase();
    const contentTypes = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".pdf": "application/pdf",
      ".txt": "text/plain; charset=utf-8",
    };

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=300");
    if (contentTypes[ext]) {
      res.setHeader("Content-Type", contentTypes[ext]);
    }

    return fs.createReadStream(candidatePath).pipe(res);
  } catch (error) {
    console.error("streamUploadFile error:", error);
    return res.status(500).json({ success: false, message: "Failed to stream upload file." });
  }
};

