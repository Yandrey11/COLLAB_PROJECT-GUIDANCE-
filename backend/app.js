// app.js

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import cookieParser from "cookie-parser"; // ✅ Keep only ONE
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";

// ES6 module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Load environment variables
dotenv.config();

// ✅ Connect to MongoDB
connectDB();

// ✅ Initialize Express
const app = express();

// ✅ Passport configurations (must come before routes)
import "./config/passport.js";              // user auth (Google/local)
import "./config/adminPassport.js";         // admin Google/local auth

// ✅ Core middlewares
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Session configuration (for OAuths)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "keyboard cat",
    resave: true, // Changed to true to ensure session is saved
    saveUninitialized: true, // Changed to true to save uninitialized sessions (required for OAuth)
    cookie: {
      secure: false, // set true if using https
      httpOnly: true,
      sameSite: 'lax', // Allow cross-site cookies for OAuth redirects
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
import adminSignupRoutes from "./routes/admin/adminSignupRoutes.js";
import adminLoginRoutes from "./routes/admin/adminLoginRoutes.js";
import configRoutes from "./routes/configRoutes.js";

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
import counselorNotificationRoutes from "./routes/counselorNotificationRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import counselorSettingsRoutes from "./routes/counselorSettingsRoutes.js";
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminRefreshRoutes);
app.use("/api/admin", adminSignupRoutes);
app.use("/api/admin", adminTokenRoutes);
app.use("/api/admin", sessionRoutes);
app.use("/api/admin", notificationRoutes);
app.use("/api/admin", userManagementRoutes);
app.use("/api/admin", adminRecordRoutes);
app.use("/api/admin/profile", adminProfileRoutes);
app.use("/api/admin/settings", adminSettingsRoutes);
app.use("/api/admin", announcementRoutes);
app.use("/api/admin/backups", backupRoutes);
app.use("/api/admin/analytics", analyticsRoutes);
app.use("/api/admin/reports", reportsRoutes);
app.use("/api/analytics", publicAnalyticsRoutes);
app.use("/api/counselor/notifications", counselorNotificationRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/counselor/settings", counselorSettingsRoutes);

// ✅ Register routes AFTER middleware
app.use("/api/auth", authRoutes);
app.use("/auth", googleAuthRoutes);
app.use("/auth", googleCalendarRoutes);
app.use("/auth/admin", adminGoogleAuthRoutes);

app.use("/api/reset", resetRoutes);
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
