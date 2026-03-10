import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";
import Swal from "sweetalert2";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

function Login() {
  useDocumentTitle("Login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const navigate = useNavigate();

  // ✅ Your reCAPTCHA site key (from environment variable)
  const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "6Lf-8vErAAAAAGohFk-EE6OaLY60jkwo1gTH05B7";

  // ✅ Check for error messages from URL (e.g., from Google OAuth failure)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get("error");
    
    if (error) {
      // Clean up URL
      window.history.replaceState({}, document.title, "/login");
      
      let errorMessage = "Login failed. Please try again.";
      switch (error) {
        case "unauthorized":
          errorMessage = "Authentication failed. Please try again.";
          break;
        case "google_auth_failed":
          errorMessage = "Google authentication failed. Please try again or use email/password.";
          break;
        case "server_error":
          errorMessage = "Server error. Please try again later.";
          break;
        default:
          errorMessage = "Login failed. Please try again.";
      }
      
      Swal.fire({
        icon: "error",
        title: "Login Failed",
        text: errorMessage,
      });
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.post(`${baseUrl}/api/auth/login`, {
        email,
        password,
        recaptchaToken, // ✅ match backend variable name
      });

      localStorage.setItem("authToken", res.data.token);
      localStorage.setItem("token", res.data.token); // Store as both for consistency
      localStorage.setItem("user", JSON.stringify(res.data.user || res.data.result));

      await Swal.fire({
        icon: "success",
        title: "Login Successful!",
        text: "Welcome back!",
        timer: 2000,
        showConfirmButton: false,
      });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Login Failed",
        text: err.response?.data?.message || "Invalid email or password",
      });
    }
  };
  const handleFacebookLogin = () => {
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    window.location.href = `${baseUrl}/auth/facebook`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center page-bg font-sans p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8 md:p-12" role="main">
        <section className="flex flex-col gap-6" aria-label="Login form">
          <button
            type="button"
            className="self-start flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50 hover:text-gray-700 transition-all"
            onClick={() => navigate("/")}
            aria-label="Go back to landing page"
          >
            ← Go Back
          </button>

          <div className="mb-2">
            <h1 className="text-3xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-gray-500 mt-2 text-sm">Sign in to access records, reports, notifications, and more.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1">Email address</label>
              <input
                id="email"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            <ReCAPTCHA
              sitekey={SITE_KEY}
              onChange={(token) => setRecaptchaToken(token)}
              style={{ alignSelf: "center" }}
            />

            <div className="flex justify-end text-sm">
              <a className="text-indigo-600 font-semibold hover:text-indigo-500" href="./forgot-password">
                Forgot password?
              </a>
            </div>

            <button type="submit" className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
              Log in to Dashboard
            </button>

            <div className="relative flex items-center gap-4 py-2 text-xs uppercase text-gray-400 font-semibold tracking-wider before:h-px before:flex-1 before:bg-gray-200 after:h-px after:flex-1 after:bg-gray-200">
              <span>or continue with</span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                className="flex items-center justify-center gap-3 w-full py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-semibold hover:bg-gray-50 hover:border-indigo-100 transition-all"
                onClick={() => {
                  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
                  window.location.href = `${baseUrl}/auth/google`;
                }}
                aria-label="Sign in with Google"
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="google" width="18" />
                Google
              </button>
            </div>

            <button
              type="button"
              className="w-full py-3 rounded-xl font-semibold text-indigo-600 border border-indigo-100 bg-white hover:bg-indigo-50 transition-all"
              onClick={() => navigate("/signup")}
            >
              Create a counselor account
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default Login;
