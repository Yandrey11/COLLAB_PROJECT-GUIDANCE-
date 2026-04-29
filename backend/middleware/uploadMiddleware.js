import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads", "profiles");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-userId-originalname
    // Support both user (counselor) and admin
    const userId = req.user?._id || req.admin?._id || "unknown";
    const timestamp = Date.now();
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    const ext = path.extname(sanitizedOriginalName);
    const nameWithoutExt = path.basename(sanitizedOriginalName, ext);
    cb(null, `${timestamp}-${userId}-${nameWithoutExt}${ext}`);
  },
});

// File filter - only allow images
const fileFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed."
      ),
      false
    );
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

// Middleware for single file upload
export const uploadProfilePicture = upload.single("profilePicture");

// Helper function to get file URL
export const getFileUrl = (filename, baseUrl = null) => {
  if (!filename) return null;
  // If it's already a full URL (from cloud storage), return as is
  if (filename.startsWith("http://") || filename.startsWith("https://")) {
    return filename;
  }
  // Normalize any stored path (absolute, relative, or just filename)
  // into a web path under /uploads/profiles.
  let webPath = "";
  if (filename.includes("/uploads/")) {
    webPath = filename.substring(filename.indexOf("/uploads/"));
  } else {
    webPath = `/uploads/profiles/${path.basename(filename)}`;
  }
  // If baseUrl is provided, return full URL
  if (baseUrl) {
    return `${baseUrl}${webPath}`;
  }
  // Otherwise, construct the relative URL for local storage
  return webPath;
};

// Helper function to delete old profile picture file
export const deleteProfilePictureFile = async (fileUrl) => {
  if (!fileUrl) return;

  // Remote avatar (e.g. Google profile photo) — nothing on disk to remove
  if (
    typeof fileUrl === "string" &&
    (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) &&
    !fileUrl.includes("/uploads/profiles/")
  ) {
    return;
  }

  // If it's a full URL, extract the filename
  let filename = fileUrl;
  if (fileUrl.includes("/uploads/profiles/")) {
    filename = fileUrl.split("/uploads/profiles/")[1];
  }
  
  const filePath = path.join(uploadsDir, filename);
  
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`✅ Deleted old profile picture: ${filename}`);
    }
  } catch (error) {
    console.error(`⚠️ Error deleting profile picture file: ${error.message}`);
    // Don't throw error - file deletion failure shouldn't break the flow
  }
};

