import { google } from "googleapis";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import Counselor from "../models/Counselor.js";
import GoogleUser from "../models/GoogleUser.js";
import Admin from "../models/Admin.js";
import { encryptToken } from "../utils/tokenEncryption.js";

dotenv.config();

export const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_DRIVE_REDIRECT_URI
);

// --- Step 1: Redirect user to Google OAuth consent screen ---
export const googleDriveAuth = async (req, res) => {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const token = req.query.token;

  if (!token) {
    return res.redirect(`${clientUrl}/records?error=drive_auth_token_missing`);
  }

  const scopes = ["https://www.googleapis.com/auth/drive.file"];
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
    state: token,
  });
  res.redirect(authUrl);
};

// --- Step 2: Handle OAuth callback ---
export const googleDriveCallback = async (req, res) => {
  const code = req.query.code;
  const stateToken = req.query.state;
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

  if (!code || !stateToken) {
    return res.redirect(`${clientUrl}/records?error=drive_connection_failed`);
  }

  try {
    const decoded = jwt.verify(stateToken, process.env.JWT_SECRET);

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    let account = await Counselor.findById(decoded.id);
    let accountType = "counselor";

    if (!account) {
      account = await GoogleUser.findById(decoded.id);
      accountType = "google";
    }

    if (!account) {
      account = await Admin.findById(decoded.id);
      accountType = "admin";
    }

    if (!account && decoded.email) {
      account = await Counselor.findOne({ email: decoded.email });
      accountType = "counselor";
      if (!account) {
        account = await GoogleUser.findOne({ email: decoded.email });
        accountType = "google";
      }
      if (!account) {
        account = await Admin.findOne({ email: decoded.email });
        accountType = "admin";
      }
    }

    if (!account) {
      return res.redirect(`${clientUrl}/records?error=drive_user_not_found`);
    }

    if (tokens.access_token) {
      account.googleCalendarAccessToken = encryptToken(tokens.access_token);
    }

    // Google may not return refresh_token on subsequent consents.
    // Keep existing refresh token if a new one is not returned.
    if (tokens.refresh_token) {
      account.googleCalendarRefreshToken = encryptToken(tokens.refresh_token);
    }

    if (tokens.expiry_date) {
      account.googleCalendarTokenExpires = new Date(tokens.expiry_date);
    }

    await account.save();

    console.log(`✅ Google Drive connected successfully for ${account.email} (${accountType})`);
    res.redirect(`${clientUrl}/records?success=drive_connected`);
  } catch (err) {
    console.error("❌ Error during Google OAuth callback:", err);
    res.redirect(`${clientUrl}/records?error=drive_connection_failed`);
  }
};
