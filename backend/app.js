// app.js

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import passport from "passport";
import cookieParser from "cookie-parser"; // ✅ Keep only ONE
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import { purgeExpiredArchivedRecords } from "./controllers/recordController.js";
import { backfillAnnouncementNotifications } from "./controllers/counselorNotificationController.js";
import { globalApiLimiter } from "./middleware/rateLimitMiddleware.js";
import { cleanupTempFiles } from "./utils/tempCleanup.js";

// ES6 module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Load environment variables
dotenv.config();

// ✅ Require secrets from env (never from db or hardcoded)
if (!process.env.JWT_SECRET || !process.env.SESSION_SECRET) {
  console.error("❌ FATAL: JWT_SECRET and SESSION_SECRET must be set in .env");
  process.exit(1);
}

// ✅ Connect to MongoDB
connectDB();

const ARCHIVE_PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;
setTimeout(() => {
  purgeExpiredArchivedRecords().catch((e) => console.error("[archive-purge] initial run:", e));
}, 60_000);
setInterval(() => {
  purgeExpiredArchivedRecords().catch((e) => console.error("[archive-purge] scheduled run:", e));
}, ARCHIVE_PURGE_INTERVAL_MS);

// One-time backfill so previously broadcast announcements reach Google-signed-in
// counselors (the original fan-out only included the Counselor collection).
setTimeout(() => {
  backfillAnnouncementNotifications().catch((e) =>
    console.error("[announcement-backfill] failed:", e)
  );
}, 5_000);

// ✅ Initialize Express
const app = express();
const isProd = process.env.NODE_ENV === "production";
if (process.env.TRUST_PROXY === "true" || isProd) {
  app.set("trust proxy", 1);
}
const enableHelmet = String(process.env.ENABLE_HELMET || "true").toLowerCase() === "true";
const jsonBodyLimit = process.env.JSON_BODY_LIMIT || "1mb";
const urlencodedBodyLimit = process.env.URLENCODED_BODY_LIMIT || "1mb";
const uploadsAccessMode = String(process.env.UPLOADS_ACCESS_MODE || "hardened").toLowerCase();
const tempCleanupEnabled = String(process.env.TEMP_CLEANUP_ENABLED || "true").toLowerCase() === "true";
const tempFileTtlHours = Number(process.env.TEMP_FILE_TTL_HOURS || 24);

if (tempCleanupEnabled) {
  setTimeout(() => {
    cleanupTempFiles({ ttlHours: tempFileTtlHours })
      .then(({ deleted }) => {
        if (deleted > 0) console.log(`[temp-cleanup] initial run removed ${deleted} file(s)`);
      })
      .catch((e) => console.error("[temp-cleanup] initial run:", e));
  }, 30_000);

  setInterval(() => {
    cleanupTempFiles({ ttlHours: tempFileTtlHours })
      .then(({ deleted }) => {
        if (deleted > 0) console.log(`[temp-cleanup] scheduled run removed ${deleted} file(s)`);
      })
      .catch((e) => console.error("[temp-cleanup] scheduled run:", e));
  }, ARCHIVE_PURGE_INTERVAL_MS);
}

// Session cookie sameSite policy:
// - default: "lax" (safe and works for most same-site flows)
// - override with SESSION_COOKIE_SAMESITE=none for cross-site deployments
const rawSameSite = String(process.env.SESSION_COOKIE_SAMESITE || "lax").toLowerCase();
const sessionSameSite = ["lax", "strict", "none"].includes(rawSameSite) ? rawSameSite : "lax";

// `SameSite=None` requires Secure in modern browsers.
const sessionCookieSecure = isProd || sessionSameSite === "none";

// ✅ Passport configurations (must come before routes)
import "./config/passport.js";              // user auth (Google/local)
import "./config/adminPassport.js";         // admin Google/local auth

// ✅ Core middlewares
if (enableHelmet) {
  app.use(
    helmet({
      // Keep CSP off initially to avoid breaking OAuth + existing frontend/CDN assets.
      contentSecurityPolicy: false,
      // Keep compatible with current cross-origin image usage.
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
}
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);
app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: urlencodedBodyLimit }));
app.use(cookieParser());
app.use("/api", globalApiLimiter);

// Serve static files from uploads directory
if (uploadsAccessMode === "public") {
  app.use("/uploads", express.static(path.join(__dirname, "uploads")));
}

// ✅ Session configuration (for OAuths)
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    // Reduce unnecessary session rewrites and session creation surface.
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: sessionCookieSecure,
      httpOnly: true,
      sameSite: sessionSameSite,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
    name: 'sessionId', // Explicit session name
  })
);

// ✅ Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// ✅ Health check route
app.get("/", (req, res) => {
  res.send("✅ Backend server is running...");
});

// ✅ Import routes
import authRoutes from "./routes/authRoutes.js";
import googleAuthRoutes from "./routes/googleAuthRoutes.js";
import googleCalendarRoutes from "./routes/googleCalendarRoutes.js";
import resetRoutes from "./routes/resetRoutes.js";
import adminRoutes from "./routes/admin/adminRoutes.js";
import adminGoogleAuthRoutes from "./routes/admin/adminGoogleAuthRoutes.js";
import adminRefreshRoutes from "./routes/admin/adminRefreshRoutes.js";

import recordRoutes from "./routes/recordRoutes.js";
import googleDriveRoutes from "./routes/googleDriveRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";

import adminTokenRoutes from "./routes/admin/adminTokenRoutes.js";
import sessionRoutes from "./routes/admin/sessionRoutes.js";
import notificationRoutes from "./routes/admin/notificationRoutes.js";
import userManagementRoutes from "./routes/admin/userManagementRoutes.js";
import adminRecordRoutes from "./routes/admin/adminRecordRoutes.js";
import adminProfileRoutes from "./routes/admin/adminProfileRoutes.js";
import adminSettingsRoutes from "./routes/admin/adminSettingsRoutes.js";
import announcementRoutes from "./routes/admin/announcementRoutes.js";
import backupRoutes from "./routes/admin/backupRoutes.js";
import analyticsRoutes from "./routes/admin/analyticsRoutes.js";
import publicAnalyticsRoutes from "./routes/analyticsRoutes.js";
import reportsRoutes from "./routes/admin/reportsRoutes.js";
import masterDataRoutes from "./routes/admin/masterDataRoutes.js";
import counselorNotificationRoutes from "./routes/counselorNotificationRoutes.js";
import counselorMessageRoutes from "./routes/counselorMessageRoutes.js";
import adminMessageRoutes from "./routes/admin/adminMessageRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import counselorSettingsRoutes from "./routes/counselorSettingsRoutes.js";
import uploadAccessRoutes from "./routes/uploadAccessRoutes.js";
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminRefreshRoutes);
app.use("/api/admin", adminTokenRoutes);
app.use("/api/admin", sessionRoutes);
app.use("/api/admin", notificationRoutes);
app.use("/api/admin", adminMessageRoutes);
app.use("/api/admin", userManagementRoutes);
app.use("/api/admin", adminRecordRoutes);
app.use("/api/admin/profile", adminProfileRoutes);
app.use("/api/admin/settings", adminSettingsRoutes);
app.use("/api/admin", announcementRoutes);
app.use("/api/admin/backups", backupRoutes);
app.use("/api/admin/analytics", analyticsRoutes);
app.use("/api/admin/reports", reportsRoutes);
app.use("/api/admin", masterDataRoutes);
app.use("/api/analytics", publicAnalyticsRoutes);
app.use("/api/counselor/notifications", counselorNotificationRoutes);
app.use("/api/counselor/messages", counselorMessageRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/counselor/settings", counselorSettingsRoutes);
app.use("/api/uploads", uploadAccessRoutes);

// ✅ Register routes AFTER middleware
app.use("/api/auth", authRoutes);
app.use("/auth", googleAuthRoutes);
app.use("/auth", googleCalendarRoutes);
app.use("/auth/admin", adminGoogleAuthRoutes);

app.use("/api/reset", resetRoutes);
app.use("/api/records", recordRoutes);
app.use("/auth", googleDriveRoutes);

// ✅ Reports route (must come after express.json())
app.use("/api/reports", reportRoutes);

// ✅ Error handling
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.stack);
  res.status(500).json({ message: "Internal server error" });
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);

export default app;
