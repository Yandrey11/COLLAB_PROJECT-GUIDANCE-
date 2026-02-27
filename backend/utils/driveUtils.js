import { google } from "googleapis";
import Counselor from "../models/Counselor.js";
import GoogleUser from "../models/GoogleUser.js";
import Admin from "../models/Admin.js";
import { decryptToken, encryptToken } from "./tokenEncryption.js";

const getOAuth2Client = () =>
  new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/auth/google/callback"
  );

/**
 * Get Drive client from user or admin (whoever is in the request).
 * Supports req.user (counselor) and req.admin (admin).
 */
export const getDriveClientFromRequest = async (req) => {
  const person = req.admin || req.user;
  if (!person) return null;

  let accessToken = person.googleCalendarAccessToken;
  let refreshToken = person.googleCalendarRefreshToken;
  let tokenExpires = person.googleCalendarTokenExpires;

  if (!accessToken) {
    const uid = person._id || person.id;
    const dbAdmin = await Admin.findById(uid)?.select("googleCalendarAccessToken googleCalendarRefreshToken googleCalendarTokenExpires");
    const dbUser = await Counselor.findById(uid)?.select("googleCalendarAccessToken googleCalendarRefreshToken googleCalendarTokenExpires");
    const googleUser = await GoogleUser.findById(uid);
    const source = dbAdmin?.googleCalendarAccessToken
      ? dbAdmin
      : dbUser?.googleCalendarAccessToken
        ? dbUser
        : googleUser?.googleCalendarAccessToken
          ? googleUser
          : null;
    if (source) {
      accessToken = decryptToken(source.googleCalendarAccessToken);
      refreshToken = decryptToken(source.googleCalendarRefreshToken);
      tokenExpires = source.googleCalendarTokenExpires;
    }
  }

  if (!accessToken) return null;

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (tokenExpires && new Date() >= new Date(tokenExpires) && refreshToken) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
      const uid = person._id || person.id;
      const toUpdate = (await Admin.findById(uid)) || (await Counselor.findById(uid)) || (await GoogleUser.findById(uid));
      if (toUpdate) {
        toUpdate.googleCalendarAccessToken = encryptToken(credentials.access_token);
        if (credentials.refresh_token) toUpdate.googleCalendarRefreshToken = encryptToken(credentials.refresh_token);
        toUpdate.googleCalendarTokenExpires = credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 3600 * 1000);
        await toUpdate.save();
      }
    } catch (err) {
      console.error("Token refresh failed:", err);
      return null;
    }
  }

  return google.drive({ version: "v3", auth: oauth2Client });
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
