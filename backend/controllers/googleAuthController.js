import jwt from "jsonwebtoken";

export const googleAuthSuccess = (req, res) => {
  try {
    console.log("🎯 googleAuthSuccess called. req.user:", req.user ? { 
      id: req.user._id || req.user.id, 
      email: req.user.email,
      has_id: !!req.user._id,
      has_id_prop: !!req.user.id
    } : "null");
    console.log("🎯 Session:", req.session ? { 
      id: req.sessionID,
      passport_user: req.session.passport?.user 
    } : "null");
    
    // ⚠️ No authenticated user found
    if (!req.user) {
      console.error("❌ Google auth success endpoint hit, but no user in session");
      console.error("❌ Request details:", {
        hasSession: !!req.session,
        sessionID: req.session?.id,
        passportUser: req.session?.passport?.user,
        headers: Object.keys(req.headers)
      });
      const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
      return res.redirect(`${clientUrl}/login?error=unauthorized`);
    }

    // ✅ Ensure we have the user ID (handle both _id and id)
    const userId = req.user._id || req.user.id;
    if (!userId) {
      console.error("❌ Google user has no ID:", req.user);
      const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
      return res.redirect(`${clientUrl}/login?error=user_id_missing`);
    }

    // ✅ Convert ObjectId to string if needed for JWT payload
    const userIdString = userId.toString();
    
    console.log(`🔑 Creating JWT token for Google user:`, {
      email: req.user.email,
      userId: userIdString,
      userIdType: typeof userId,
      userObject: {
        _id: req.user._id?.toString(),
        id: req.user.id?.toString(),
        email: req.user.email,
        name: req.user.name
      }
    });

    // ✅ Create a signed JWT that contains user info
    const token = jwt.sign(
      {
        id: userIdString,
        name: req.user.name,
        email: req.user.email,
        googleId: req.user.googleId || null,
        role: req.user.role || "counselor",
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    console.log(`✅ Google login success for ${req.user.email} (ID: ${userIdString}) - Token created. Redirecting to dashboard...`);

    // ✅ Redirect back to the dashboard with the token (encode to prevent + and / corruption in URL)
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    res.redirect(`${clientUrl}/dashboard?token=${encodeURIComponent(token)}&calendar=connected`);
  } catch (err) {
    console.error("❌ Error in googleAuthSuccess:", err);
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    res.redirect(`${clientUrl}/login?error=server_error`);
  }
};

export const googleAuthFailure = (req, res) => {
  console.warn("❌ Google authentication failed");
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  res.redirect(`${clientUrl}/login?error=google_auth_failed`);
};
