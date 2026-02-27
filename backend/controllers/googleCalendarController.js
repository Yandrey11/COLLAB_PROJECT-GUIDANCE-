import jwt from "jsonwebtoken";
import { google } from "googleapis";
import Counselor from "../models/Counselor.js";
import { encryptToken, decryptToken } from "../utils/tokenEncryption.js";

// Determine the redirect URI - use env variable or construct from backend URL
const getRedirectUri = () => {
  if (process.env.GOOGLE_CALENDAR_REDIRECT_URI) {
    return process.env.GOOGLE_CALENDAR_REDIRECT_URI;
  }
  const baseUrl = process.env.BACKEND_URL || process.env.SERVER_URL || "http://localhost:5000";
  return `${baseUrl}/auth/google/calendar/callback`;
};

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
  getRedirectUri()
);

const SCOPES = (process.env.GOOGLE_CALENDAR_SCOPES || "https://www.googleapis.com/auth/calendar.readonly")
  .split(",")
  .map((scope) => scope.trim())
  .filter(Boolean);

const buildStateToken = (payload) => {
  const signed = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "10m" });
  return Buffer.from(signed).toString("base64");
};

const decodeStateToken = (state) => {
  if (!state) return null;
  const decoded = Buffer.from(state, "base64").toString("utf-8");
  try {
    return jwt.verify(decoded, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
};

const extractTokenFromRequest = (req) => {
  // Check Authorization header first
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.split(" ")[1];
  }
  
  // Check query parameter
  if (req.query && req.query.token) {
    return req.query.token;
  }
  
  // Also check URL parameters (some frameworks parse differently)
  if (req.params && req.params.token) {
    return req.params.token;
  }
  
  return null;
};

export const startGoogleCalendarOAuth = async (req, res) => {
  console.log("🔗 Google Calendar OAuth connect request received");
  console.log("Query params:", req.query);
  console.log("Headers:", req.headers.authorization ? "Authorization header present" : "No Authorization header");
  
  const token = extractTokenFromRequest(req);
  console.log("Token extracted:", token ? "Token found" : "No token found");
  
  if (!token) {
    console.error("❌ No token found in request");
    return res.status(401).json({ message: "Authentication token is required" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ Token verified successfully for user:", decoded.id);
  } catch (err) {
    console.error("❌ Invalid JWT for Google Calendar connect:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  const state = buildStateToken({ userId: decoded.id });

  // Get the redirect URI - must match what's configured in Google Cloud Console
  const redirectUri = getRedirectUri();
  
  if (!redirectUri) {
    console.error("❌ Redirect URI is not configured!");
    return res.status(500).json({ 
      message: "Server configuration error: Google Calendar redirect URI is not set. Please configure GOOGLE_CALENDAR_REDIRECT_URI in environment variables." 
    });
  }
  
  console.log("🔗 Using redirect URI:", redirectUri);
  console.log("🔗 OAuth2 client configured redirect URI:", oauth2Client.redirectUri);
  console.log("🔗 Client ID:", (process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CLIENT_ID) ? "Set" : "Missing!");

  // Generate auth URL with explicit redirect_uri
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
    redirect_uri: redirectUri, // Explicitly include redirect_uri
  });

  console.log("✅ Generated OAuth URL with redirect_uri:", redirectUri);
  console.log("✅ Redirecting to Google OAuth URL");
  return res.redirect(authUrl);
};

export const handleGoogleCalendarCallback = async (req, res) => {
  const code = req.query.code;
  const rawState = req.query.state;

  console.log("📥 Google Calendar OAuth callback received");
  console.log("Query params:", { code: code ? "present" : "missing", state: rawState ? "present" : "missing" });

  if (!code || !rawState) {
    console.error("❌ Missing code or state in callback");
    return res.status(400).json({ message: "Missing code or state" });
  }

  const state = decodeStateToken(rawState);
  if (!state?.userId) {
    console.error("❌ Invalid state token");
    return res.status(400).json({ message: "Invalid state token" });
  }

  console.log("✅ State decoded successfully for user:", state.userId);

  try {
    // Use the same redirect URI that was used in the auth URL
    const redirectUri = getRedirectUri();
    console.log("🔄 Exchanging code for tokens with redirect URI:", redirectUri);
    
    const { tokens } = await oauth2Client.getToken({
      code,
      redirect_uri: redirectUri, // Explicitly include redirect_uri
    });
    
    console.log("✅ Tokens received successfully");
    
    // Try to find user in User collection first
    let user = await Counselor.findById(state.userId);
    let saved = false;
    
    if (user) {
      user.googleCalendarAccessToken = tokens.access_token ? encryptToken(tokens.access_token) : user.googleCalendarAccessToken;
      if (tokens.refresh_token) {
        user.googleCalendarRefreshToken = encryptToken(tokens.refresh_token);
      }
      const expiry = tokens.expiry_date || tokens.expires_at;
      if (expiry) {
        user.googleCalendarTokenExpires = new Date(expiry);
      } else {
        user.googleCalendarTokenExpires = new Date(Date.now() + 3600 * 1000);
      }
      await user.save();
      saved = true;
      console.log(`✅ Saved calendar tokens to User model for ${user.email}`);
    } else {
      // Try GoogleUser collection
      const GoogleUser = (await import("../models/GoogleUser.js")).default;
      const googleUser = await GoogleUser.findById(state.userId);
      
      if (googleUser) {
        googleUser.googleCalendarAccessToken = tokens.access_token ? encryptToken(tokens.access_token) : googleUser.googleCalendarAccessToken;
        if (tokens.refresh_token) {
          googleUser.googleCalendarRefreshToken = encryptToken(tokens.refresh_token);
        }
        const expiry = tokens.expiry_date || tokens.expires_at;
        if (expiry) {
          googleUser.googleCalendarTokenExpires = new Date(expiry);
        } else {
          // Default to 1 hour if no expiry provided
          googleUser.googleCalendarTokenExpires = new Date(Date.now() + 3600 * 1000);
        }
        await googleUser.save();
        saved = true;
        console.log(`✅ Saved calendar tokens to GoogleUser model for ${googleUser.email}`);
      }
    }
    
    if (!saved) {
      return res.status(404).json({ message: "User not found in User or GoogleUser collections" });
    }

    const redirectUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard?calendar=connected`;
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error("Google Calendar OAuth callback error:", err);
    return res
      .status(500)
      .json({ message: "Failed to connect Google Calendar", error: err.message });
  }
};

export const getDashboardCalendarEvents = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Unauthorized. User not found." });
    }

    // Check if calendar tokens are already in req.user (from protect middleware)
    let calendarAccessToken = req.user.googleCalendarAccessToken;
    let calendarRefreshToken = req.user.googleCalendarRefreshToken;
    let calendarTokenExpires = req.user.googleCalendarTokenExpires;
    
    // If not in req.user, try fetching from User or GoogleUser models
    if (!calendarAccessToken) {
      // Try User collection first
      let user = await Counselor.findById(req.user._id);
      if (user && user.googleCalendarAccessToken) {
        calendarAccessToken = decryptToken(user.googleCalendarAccessToken);
        calendarRefreshToken = decryptToken(user.googleCalendarRefreshToken);
        calendarTokenExpires = user.googleCalendarTokenExpires;
      } else {
        // Try GoogleUser collection by ID
        const GoogleUser = (await import("../models/GoogleUser.js")).default;
        let googleUser = await GoogleUser.findById(req.user._id);
        
        // If not found by ID, try by email (in case IDs don't match)
        if (!googleUser && req.user.email) {
          googleUser = await GoogleUser.findOne({ email: req.user.email });
        }
        
        // Also try by googleId if user has one
        if (!googleUser && req.user.googleId) {
          googleUser = await GoogleUser.findOne({ googleId: req.user.googleId });
        }
        
        if (googleUser && googleUser.googleCalendarAccessToken) {
          calendarAccessToken = decryptToken(googleUser.googleCalendarAccessToken);
          calendarRefreshToken = decryptToken(googleUser.googleCalendarRefreshToken);
          calendarTokenExpires = googleUser.googleCalendarTokenExpires;
          
          // Also check User collection by email if we found a GoogleUser
          if (!user && googleUser.email) {
            user = await Counselor.findOne({ email: googleUser.email });
            if (user && !user.googleCalendarAccessToken) {
              // Sync tokens to User model if it exists (store encrypted)
              user.googleCalendarAccessToken = encryptToken(calendarAccessToken);
              user.googleCalendarRefreshToken = encryptToken(calendarRefreshToken);
              user.googleCalendarTokenExpires = calendarTokenExpires;
              await user.save();
            }
          }
        }
      }
    }

    // Check if user has Google Calendar tokens
    if (!calendarAccessToken) {
      console.log(`⚠️ No calendar access token found for user ${req.user._id} (email: ${req.user.email})`);
      return res.status(200).json({
        events: [],
        message: "Google Calendar not connected. Please connect your Google Calendar first.",
        connected: false,
      });
    }

    console.log(`✅ Found calendar access token for user ${req.user.email}`);

    // Set credentials
    oauth2Client.setCredentials({
      access_token: calendarAccessToken,
      refresh_token: calendarRefreshToken,
    });

    // Refresh token if needed
    if (calendarTokenExpires && new Date() >= calendarTokenExpires) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        const newAccessToken = credentials.access_token;
        const newRefreshToken = credentials.refresh_token || calendarRefreshToken;
        const newExpiry = credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 3600 * 1000);
        
        // Update tokens in the appropriate model (encrypt before saving)
        let user = await Counselor.findById(req.user._id);
        if (user) {
          user.googleCalendarAccessToken = encryptToken(newAccessToken);
          if (newRefreshToken) {
            user.googleCalendarRefreshToken = encryptToken(newRefreshToken);
          }
          user.googleCalendarTokenExpires = newExpiry;
          await user.save();
        } else {
          // Try GoogleUser
          const GoogleUser = (await import("../models/GoogleUser.js")).default;
          const googleUser = await GoogleUser.findById(req.user._id);
          if (googleUser) {
            googleUser.googleCalendarAccessToken = encryptToken(newAccessToken);
            if (newRefreshToken) {
              googleUser.googleCalendarRefreshToken = encryptToken(newRefreshToken);
            }
            googleUser.googleCalendarTokenExpires = newExpiry;
            await googleUser.save();
          }
        }
        
        oauth2Client.setCredentials(credentials);
      } catch (refreshError) {
        console.error("Error refreshing Google Calendar token:", refreshError);
        return res.status(401).json({
          message: "Failed to refresh calendar token. Please reconnect your Google Calendar.",
          connected: false,
        });
      }
    }

    // Get calendar service
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // Get date range for events (next 30 days)
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    // Fetch events
    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: thirtyDaysFromNow.toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = (response.data.items || []).map((event) => ({
      id: event.id,
      title: event.summary || "No Title",
      description: event.description || "",
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      location: event.location || "",
      htmlLink: event.htmlLink || "",
      status: event.status,
    }));

    console.log(`✅ Fetched ${events.length} calendar events for user ${req.user.email}`);

    res.status(200).json({
      events,
      connected: true,
      total: events.length,
    });
  } catch (error) {
    console.error("❌ Error fetching dashboard calendar events:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      response: error.response?.data,
    });
    
    // If it's an auth error, return connected: false so user can reconnect
    if (error.code === 401 || error.message?.includes("invalid_token") || error.message?.includes("unauthorized")) {
      return res.status(200).json({
        events: [],
        message: "Calendar token expired or invalid. Please reconnect your Google Calendar.",
        connected: false,
      });
    }
    
    res.status(500).json({
      message: "Error fetching calendar events",
      error: error.message,
      connected: false,
    });
  }
};