import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";

export default function LoginSignup() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [signupData, setSignupData] = useState({ name: "", email: "", password: "" });
  const [signinData, setSigninData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recaptchaValue, setRecaptchaValue] = useState(null);
  const navigate = useNavigate();

  // ===================================================
  // 🔹 Input Handlers
  // ===================================================
  const handleSignupChange = (e) => {
    setError("");
    setSignupData({ ...signupData, [e.target.name]: e.target.value });
  };

  const handleSigninChange = (e) => {
    setError("");
    setSigninData({ ...signinData, [e.target.name]: e.target.value });
  };

  // ===================================================
  // 🔹 Validation
  // ===================================================
  const validateSignup = () => {
    if (!signupData.name.trim()) return setError("Name is required"), false;
    if (!/\S+@\S+\.\S+/.test(signupData.email)) return setError("Invalid email format"), false;
    if (signupData.password.length < 6)
      return setError("Password must be at least 6 characters"), false;
    return true;
  };

  const validateSignin = () => {
    if (!/\S+@\S+\.\S+/.test(signinData.email)) return setError("Invalid email format"), false;
    if (!signinData.password) return setError("Password is required"), false;
    return true;
  };

  // ===================================================
  // 🔹 Signup Submit
  // ===================================================
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (!validateSignup()) return;
    setLoading(true);
    setError("");

    try {
      const res = await axios.post("http://localhost:5000/api/auth/signup", signupData);

      if (res.data.message) {
        alert("✅ Signup successful! Please log in.");
        setIsSignUp(false);
        setSignupData({ name: "", email: "", password: "" });
      } else {
        setError("Signup failed. Please try again.");
      }
    } catch (err) {
      console.error("Signup error:", err);
      setError(err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  // ===================================================
  // 🔹 Signin Submit
  // ===================================================
  const handleSigninSubmit = async (e) => {
    e.preventDefault();
    if (!validateSignin()) return;

    if (!recaptchaValue) {
      setError("Please verify the reCAPTCHA before logging in.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await axios.post("http://localhost:5000/api/auth/login", signinData);

      if (res.data.token) {
        localStorage.setItem("authToken", res.data.token);
        if (res.data.user) localStorage.setItem("user", JSON.stringify(res.data.user));

        alert("✅ Login successful!");
        navigate("/dashboard");
      } else {
        setError("Login failed. Please try again.");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(err.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  // ===================================================
  // 🔹 UI
  // ===================================================
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #4f46e5, #9333ea)",
        minHeight: "100vh",
        minWidth: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Montserrat', sans-serif",
      }}
    >
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; }
        button { border-radius: 20px; border: 1px solid #FF4B2B; background-color: #FF4B2B; color: #FFF; font-size: 12px; font-weight: bold; padding: 12px 45px; letter-spacing: 1px; text-transform: uppercase; transition: transform 80ms ease-in; cursor: pointer; }
        button:active { transform: scale(0.95); }
        button:focus { outline: none; }
        button:disabled { opacity: 0.6; cursor: not-allowed; }
        button.ghost { background-color: transparent; border-color: #FFFFFF; }
        form { background-color: #FFFFFF; display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 0 50px; height: 100%; text-align: center; }
        input { background-color: #eee; border: none; padding: 12px 15px; margin: 8px 0; width: 100%; border-radius: 5px; }
        input:focus { outline: 2px solid #FF4B2B; }
        .error-message { color: #FF4B2B; font-size: 12px; margin: 8px 0; min-height: 20px; }
        .container { background-color: #fff; border-radius: 10px; box-shadow: 0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22); position: relative; overflow: hidden; width: 768px; max-width: 100%; min-height: 480px; height: auto; }
        .form-container { position: absolute; top: 0; height: 100%; transition: all 0.6s ease-in-out; }
        .sign-in-container { left: 0; width: 50%; z-index: 2; }
        .container.right-panel-active .sign-in-container { transform: translateX(100%); }
        .sign-up-container { left: 0; width: 50%; opacity: 0; z-index: 1; }
        .container.right-panel-active .sign-up-container { transform: translateX(100%); opacity: 1; z-index: 5; animation: show 0.6s; }
        @keyframes show { 0%, 49.99% { opacity: 0; z-index: 1; } 50%, 100% { opacity: 1; z-index: 5; } }
        .overlay-container { position: absolute; top: 0; left: 50%; width: 50%; height: 100%; overflow: hidden; transition: transform 0.6s ease-in-out; z-index: 100; }
        .container.right-panel-active .overlay-container { transform: translateX(-100%); }
        .overlay { background: linear-gradient(to right, #FF4B2B, #FF416C); color: #FFF; position: relative; left: -100%; height: 100%; width: 200%; transform: translateX(0); transition: transform 0.6s ease-in-out; }
        .container.right-panel-active .overlay { transform: translateX(50%); }
        .overlay-panel { position: absolute; display: flex; align-items: center; justify-content: center; flex-direction: column; padding: 0 40px; text-align: center; top: 0; height: 100%; width: 50%; transition: transform 0.6s ease-in-out; }
        .overlay-left { transform: translateX(-20%); }
        .container.right-panel-active .overlay-left { transform: translateX(0); }
        .overlay-right { right: 0; transform: translateX(0); }
        .container.right-panel-active .overlay-right { transform: translateX(20%); }
      `}</style>

      <div className={`container ${isSignUp ? "right-panel-active" : ""}`}>
        {/* ========== SIGN UP FORM ========== */}
        <div className="form-container sign-up-container">
          <form onSubmit={handleSignupSubmit}>
            <h1>Create Account</h1>
            <input type="text" name="name" placeholder="Name" value={signupData.name} onChange={handleSignupChange} required />
            <input type="email" name="email" placeholder="Email" value={signupData.email} onChange={handleSignupChange} required />
            <input type="password" name="password" placeholder="Password (min 6 characters)" value={signupData.password} onChange={handleSignupChange} required />
            <div className="error-message">{isSignUp ? error : ""}</div>
            <button type="submit" disabled={loading}>{loading ? "Creating..." : "Sign Up"}</button>
          </form>
        </div>

        {/* ========== SIGN IN FORM ========== */}
        <div className="form-container sign-in-container">
          <form onSubmit={handleSigninSubmit}>
            <h1 style={{ color: "#9333ea" }}>Sign in</h1>
            <input type="email" name="email" placeholder="Email" value={signinData.email} onChange={handleSigninChange} required />
            <input type="password" name="password" placeholder="Password" value={signinData.password} onChange={handleSigninChange} required />
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                navigate("/forgot-password");
              }}
              style={{ margin: "10px 0", fontSize: "12px", color: "#333" }}
            >
              Forgot your password?
            </a>

            {/* ✅ reCAPTCHA */}
            <ReCAPTCHA
              sitekey="6Lf-8vErAAAAAGohFk-EE6OaLY60jkwo1gTH05B7"
              onChange={(value) => setRecaptchaValue(value)}
              style={{ margin: "10px 0" }}
            />

            <div className="error-message">{!isSignUp ? error : ""}</div>
            <button type="submit" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>

        {/* ========== OVERLAY PANELS ========== */}
        <div className="overlay-container">
          <div className="overlay">
            <div className="overlay-panel overlay-left">
              <h1>Welcome Back!</h1>
              <p>To keep connected, login with your credentials</p>
              <button className="ghost" onClick={() => setIsSignUp(false)}>Login</button>
            </div>
            <div className="overlay-panel overlay-right">
              <h1>Hello, Friend!</h1>
              <p>Enter your details and start your journey</p>
              <button className="ghost" onClick={() => setIsSignUp(true)}>Sign Up</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
