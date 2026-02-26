import express from "express";
import passport from "passport";
import "../config/passport.js";
import { googleAuthSuccess, googleAuthFailure } from "../controllers/googleAuthController.js";

const router = express.Router();

// Start Google login - include calendar and drive scopes for automatic connection
router.get(
  "/google",
  passport.authenticate("google", {
    scope: [
      "profile",
      "email",
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/drive.file",
    ],
    accessType: "offline",
    prompt: "consent",
  })
);

// Callback from Google
router.get(
  "/google/callback",
  (req, res, next) => {
    console.log("🔵 Google OAuth callback received. Query params:", req.query);
    console.log("🔵 Session ID:", req.sessionID);
    console.log("🔵 Session user before auth:", req.session?.passport?.user);
    next();
  },
  passport.authenticate("google", { 
    failureRedirect: "/auth/google/failure",
    session: true // Explicitly enable session
  }),
  (req, res, next) => {
    console.log("🟢 After passport.authenticate. req.user:", req.user ? { id: req.user._id || req.user.id, email: req.user.email } : "null");
    console.log("🟢 Session user after auth:", req.session?.passport?.user);
    next();
  },
  googleAuthSuccess
);

// Failure route
router.get("/google/failure", googleAuthFailure);

// (Optional) simple test route
router.get("/test", (req, res) => res.send("✅ Google Auth Route Working"));

export default router;
