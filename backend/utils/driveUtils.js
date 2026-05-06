import fs from "fs";
import path from "path";
import { google } from "googleapis";
import Counselor from "../models/Counselor.js";
import GoogleUser from "../models/GoogleUser.js";
import Admin from "../models/Admin.js";
import { decryptToken, encryptToken } from "./tokenEncryption.js";
import { emailLookupHash } from "./userLookup.js";

const getOAuth2Client = () =>
  new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/auth/google/callback"
  );

/** Fallback Drive client using `GOOGLE_REFRESH_TOKEN` (single workspace account). */
const getSystemOAuthDriveClient = async () => {
  try {
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    if (!refreshToken) return null;

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_DRIVE_REDIRECT_URI || process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/auth/google/callback"
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    await oauth2Client.getAccessToken();
    return google.drive({ version: "v3", auth: oauth2Client });
  } catch (error) {
    console.warn("Drive system OAuth unavailable:", error.message || error);
    return null;
  }
};

/** Fallback using `config/google-service-account.json` if present. */
const getServiceAccountDriveClient = async () => {
  try {
    const serviceAccountPath = path.join(process.cwd(), "config", "google-service-account.json");
    if (!fs.existsSync(serviceAccountPath)) return null;

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });
    return google.drive({ version: "v3", auth });
  } catch (error) {
    console.warn("Drive service account unavailable:", error.message || error);
    return null;
  }
};

const googleTokenSelect =
  "googleCalendarAccessToken googleCalendarRefreshToken googleCalendarTokenExpires email";

async function loadGoogleTokensFromDb(uid, email) {
  let accessToken = null;
  let refreshToken = null;
  let tokenExpires = null;

  const dbAdmin = await Admin.findById(uid).select(googleTokenSelect);
  const dbUser = await Counselor.findById(uid).select(googleTokenSelect);
  const googleUser = await GoogleUser.findById(uid).select(googleTokenSelect);

  let source = dbAdmin?.googleCalendarAccessToken
    ? dbAdmin
    : dbUser?.googleCalendarAccessToken
      ? dbUser
      : googleUser?.googleCalendarAccessToken
        ? googleUser
        : null;

  if (!source && email) {
    const lookup = emailLookupHash(email);
    const byAdmin = await Admin.findOne({ emailLookup: lookup }).select(googleTokenSelect);
    const byCounselor = await Counselor.findOne({ emailLookup: lookup }).select(googleTokenSelect);
    const byGoogle = await GoogleUser.findOne({ emailLookup: lookup }).select(googleTokenSelect);
    source = byAdmin?.googleCalendarAccessToken
      ? byAdmin
      : byCounselor?.googleCalendarAccessToken
        ? byCounselor
        : byGoogle?.googleCalendarAccessToken
          ? byGoogle
          : null;
  }

  if (source) {
    accessToken = decryptToken(source.googleCalendarAccessToken);
    refreshToken = decryptToken(source.googleCalendarRefreshToken);
    tokenExpires = source.googleCalendarTokenExpires;
  }

  return { accessToken, refreshToken, tokenExpires, sourceModel: source };
}

/**
 * Get Drive client from user or admin (whoever is in the request).
 * Validates OAuth; falls back to system refresh token or service account (same strategy as record uploads).
 */
export const getDriveClientFromRequest = async (req) => {
  const person = req.admin || req.user;
  if (!person) return null;

  const uid = person._id || person.id;
  const email = person.email;

  let accessToken = person.googleCalendarAccessToken;
  let refreshToken = person.googleCalendarRefreshToken;
  let tokenExpires = person.googleCalendarTokenExpires;

  if (!accessToken) {
    const fromDb = await loadGoogleTokensFromDb(uid, email);
    accessToken = fromDb.accessToken;
    refreshToken = fromDb.refreshToken;
    tokenExpires = fromDb.tokenExpires;
  }

  const tryFallbacks = async (reason) => {
    if (reason) console.warn("Drive:", reason);
    const systemDrive = await getSystemOAuthDriveClient();
    if (systemDrive) {
      console.warn("⚠️ Using system OAuth Drive (GOOGLE_REFRESH_TOKEN) for upload");
      return systemDrive;
    }
    const serviceDrive = await getServiceAccountDriveClient();
    if (serviceDrive) {
      console.warn("⚠️ Using service account Drive for upload");
      return serviceDrive;
    }
    return null;
  };

  if (!accessToken) {
    return tryFallbacks("No Google OAuth tokens on account —");
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (tokenExpires && new Date() >= new Date(tokenExpires) && refreshToken) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
      const toUpdate =
        (await Admin.findById(uid)) ||
        (await Counselor.findById(uid)) ||
        (await GoogleUser.findById(uid)) ||
        (email
          ? (await Admin.findOne({ emailLookup: emailLookupHash(email) })) ||
            (await Counselor.findOne({ emailLookup: emailLookupHash(email) })) ||
            (await GoogleUser.findOne({ emailLookup: emailLookupHash(email) }))
          : null);
      if (toUpdate) {
        toUpdate.googleCalendarAccessToken = encryptToken(credentials.access_token);
        if (credentials.refresh_token) toUpdate.googleCalendarRefreshToken = encryptToken(credentials.refresh_token);
        toUpdate.googleCalendarTokenExpires = credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : new Date(Date.now() + 3600 * 1000);
        await toUpdate.save();
      }
    } catch (err) {
      console.warn("Drive token refresh failed:", err.message || err);
      return tryFallbacks("refresh failed —");
    }
  }

  try {
    await oauth2Client.getAccessToken();
    return google.drive({ version: "v3", auth: oauth2Client });
  } catch (e) {
    return tryFallbacks(`Stored OAuth rejected (${e.message || "invalid"}) —`);
  }
};

/**
 * Get or create "Reports" folder in user's Drive.
 */
export const getOrCreateReportsFolder = async (drive) => {
  const folderName = "Reports";
  try {
    const listRes = await drive.files.list({
      q: `name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`,
      fields: "files(id, name)",
      spaces: "drive",
    });
    const existing = listRes.data.files?.[0];
    if (existing) return existing.id;

    const createRes = await drive.files.create({
      resource: {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });
    console.log(`✅ Created "${folderName}" folder in Drive`);
    return createRes.data.id;
  } catch (err) {
    console.error("Failed to get/create Reports folder:", err);
    return null;
  }
};
