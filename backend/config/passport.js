import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import GoogleUser from "../models/GoogleUser.js";
import { encryptToken } from "../utils/tokenEncryption.js";

dotenv.config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error("Google account has no email"), null);

        // ✅ Check in googleusers collection
        let user = await GoogleUser.findOne({ googleId: profile.id });

        // Since we requested calendar scopes, the accessToken and refreshToken have calendar access
        // Save them as calendar tokens for automatic calendar connection
        const calendarTokenExpires = new Date();
        calendarTokenExpires.setHours(calendarTokenExpires.getHours() + 1); // Google tokens typically expire in 1 hour
        
        const encryptedAccess = encryptToken(accessToken);
        const encryptedRefresh = refreshToken ? encryptToken(refreshToken) : null;

        if (!user) {
          user = await GoogleUser.create({
            googleId: profile.id,
            name: profile.displayName,
            email,
            googleCalendarAccessToken: encryptedAccess,
            googleCalendarRefreshToken: encryptedRefresh,
            googleCalendarTokenExpires: calendarTokenExpires,
          });
          console.log(`✅ New Google user created with calendar access: ${email}`);
        } else {
          // Update user info and calendar tokens
          user.name = profile.displayName;
          user.email = email;
          user.googleCalendarAccessToken = encryptedAccess;
          if (encryptedRefresh) {
            user.googleCalendarRefreshToken = encryptedRefresh;
          }
          user.googleCalendarTokenExpires = calendarTokenExpires;
          await user.save();
          console.log(`✅ Google user updated with calendar access: ${email}`);
        }

        // Also sync calendar tokens to User model if a User exists with the same email
        try {
          const CounselorModel = (await import("../models/Counselor.js")).default;
          const regularUser = await CounselorModel.findOne({ email });
          if (regularUser) {
            regularUser.googleCalendarAccessToken = user.googleCalendarAccessToken;
            regularUser.googleCalendarRefreshToken = user.googleCalendarRefreshToken;
            regularUser.googleCalendarTokenExpires = user.googleCalendarTokenExpires;
            if (!regularUser.googleId) {
              regularUser.googleId = user.googleId;
            }
            await regularUser.save();
            console.log(`✅ Synced calendar tokens to Counselor model for ${email}`);
          }
        } catch (syncError) {
          console.error("⚠️ Error syncing calendar tokens to User model:", syncError);
          // Non-critical error, continue
        }

        console.log(`✅ Google strategy completed successfully for user: ${user.email} (ID: ${user._id})`);
        return done(null, user);
      } catch (err) {
        console.error("❌ Google strategy error:", err);
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  try {
    // ✅ Use _id if available, otherwise use id (Mongoose virtual getter)
    const userId = user._id || user.id;
    if (!userId) {
      console.error("❌ No user ID found for serialization:", user);
      return done(new Error("User has no ID"), null);
    }
    const userIdString = userId.toString();
    console.log(`📦 Serializing user: ${user.email || 'unknown'} with ID: ${userIdString}`);
    done(null, userIdString);
  } catch (err) {
    console.error("❌ Error in passport serializeUser:", err);
    done(err, null);
  }
});

passport.deserializeUser(async (id, done) => {
  try {
    console.log(`📥 Deserializing user with ID: ${id} (type: ${typeof id})`);
    
    // Try to find by ObjectId first
    let user = await GoogleUser.findById(id);
    
    // If not found, try to find by string ID
    if (!user && typeof id === 'string') {
      const mongoose = (await import("mongoose")).default;
      if (mongoose.Types.ObjectId.isValid(id)) {
        const objectId = new mongoose.Types.ObjectId(id);
        user = await GoogleUser.findById(objectId);
      }
    }
    
    if (!user) {
      console.warn(`⚠️ GoogleUser not found during deserialization with ID: ${id}`);
      return done(null, false);
    }
    
    console.log(`✅ Successfully deserialized user: ${user.email}`);
    done(null, user);
  } catch (err) {
    console.error("❌ Error in passport deserializeUser:", err);
    done(err, null);
  }
});

export default passport;
