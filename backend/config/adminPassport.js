import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import crypto from "crypto";
import dotenv from "dotenv";
import Admin from "../models/Admin.js";
import GoogleUser from "../models/GoogleUser.js";
import { encryptToken } from "../utils/tokenEncryption.js";

dotenv.config();

passport.use(
  "admin-google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_ADMIN_CALLBACK_URL,
      scope: ["profile", "email", "https://www.googleapis.com/auth/drive.file"],
      accessType: "offline",
      prompt: "consent",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error("Google account has no email"), null);

        let admin = await Admin.findOne({ email });

        if (!admin) {
          // Check if GoogleUser with admin role exists (e.g. promoted from regular user)
          const googleUser = await GoogleUser.findOne({ email, role: "admin" });
          if (googleUser) {
            const tempPassword = crypto.randomBytes(24).toString("hex");
            admin = await Admin.create({
              name: profile.displayName || googleUser.name,
              email,
              password: tempPassword,
              role: "admin",
              googleId: profile.id,
              googleCalendarAccessToken: encryptToken(accessToken),
              googleCalendarRefreshToken: refreshToken ? encryptToken(refreshToken) : null,
              googleCalendarTokenExpires: new Date(Date.now() + 3600 * 1000),
              profilePicture: profile.photos?.[0]?.value || googleUser.profilePicture,
            });
            console.log(`✅ Admin created from GoogleUser for ${email} - use Forgot Password to set a password for manual login`);
          } else {
            console.log(`🚫 Unauthorized Google login attempt: ${email}`);
            return done(null, false);
          }
        } else {
          admin.googleId = profile.id;
          admin.googleCalendarAccessToken = encryptToken(accessToken);
          if (refreshToken) admin.googleCalendarRefreshToken = encryptToken(refreshToken);
          admin.googleCalendarTokenExpires = new Date(Date.now() + 3600 * 1000);
          if (profile.photos?.[0]?.value && !admin.profilePicture) {
            admin.profilePicture = profile.photos[0].value;
          }
          await admin.save();
        }

        done(null, admin);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

passport.serializeUser((admin, done) => done(null, admin.id));
passport.deserializeUser(async (id, done) => {
  const admin = await Admin.findById(id);
  done(null, admin);
});

export default passport;
