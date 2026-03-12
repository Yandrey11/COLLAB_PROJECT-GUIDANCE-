import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";
import Swal from "sweetalert2";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

export default function AdminLogin() {
  useDocumentTitle("Admin Login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!captchaToken) {
      setMessage("⚠️ Please verify that you are not a robot.");
      setLoading(false);
      return;
    }

    try {
      console.log("🔐 Attempting admin login for:", email);
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.post(`${baseUrl}/api/admin/login`, {
        email,
        password,
        captchaToken,
      });

      console.log("✅ Login response received:", res.data);

      // Verify token exists in response
      if (!res.data.token) {
        console.error("❌ No token in response:", res.data);
        setMessage("⚠️ Login failed: No token received from server.");
        setLoading(false);
        return;
      }

      // Store token and admin data
      localStorage.setItem("adminToken", res.data.token);
      localStorage.setItem("admin", JSON.stringify(res.data.admin));

      // Verify token was stored
      const storedToken = localStorage.getItem("adminToken");
      if (!storedToken) {
        console.error("❌ Token not stored in localStorage");
        setMessage("⚠️ Failed to store token. Please try again.");
        setLoading(false);
        return;
      }

      console.log("✅ Token stored successfully, redirecting to dashboard");
      await Swal.fire({
        icon: "success",
        title: "Login Successful!",
        text: "Admin login successful!",
        timer: 2000,
        showConfirmButton: false,
      });
      navigate("/admindashboard", { replace: true });
    } catch (err) {
      console.error("❌ Login error:", err);
      console.error("Error response:", err.response?.data);
      console.error("Error status:", err.response?.status);
      setMessage(err.response?.data?.message || "Login failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    window.location.href = `${baseUrl}/auth/admin/google`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center page-bg font-sans p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8 md:p-12" role="main">
        <section className="flex flex-col gap-6" aria-label="Admin login form">
          <button
            type="button"
            className="self-start flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-gray-500 text-sm font-semibold hover:bg-gray-50 hover:text-gray-700 transition-all"
            onClick={() => navigate("/")}
          >
            ← Go Back
          </button>

          <div className="mb-2">
            <h1 className="text-3xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-gray-500 mt-2 text-sm">Sign in to access records, reports, notifications, and more.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label htmlFor="admin-email" className="block text-sm font-semibold text-gray-700 mb-1">Admin email</label>
              <input
                id="admin-email"
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
              <label htmlFor="admin-password" className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
              <input
                id="admin-password"
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
              sitekey="6Lf98vErAAAAAFBhvxrQnb4NCHHLXwYb-QOlKSQ3"
              onChange={(token) => setCaptchaToken(token)}
              style={{ alignSelf: "center" }}
            />

            <div className="flex justify-end text-sm">
              <a className="text-indigo-600 font-semibold hover:text-indigo-500" href="/forgot-password?returnTo=admin">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-65 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? "Authenticating..." : "Log in to Dashboard"}
            </button>

            <div className="relative flex items-center gap-4 py-2 text-xs uppercase text-gray-400 font-semibold tracking-wider before:h-px before:flex-1 before:bg-gray-200 after:h-px after:flex-1 after:bg-gray-200">
              <span>or continue with</span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                className="flex items-center justify-center gap-3 w-full py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-semibold hover:bg-gray-50 hover:border-indigo-100 transition-all"
                onClick={handleGoogleLogin}
                aria-label="Sign in with Google"
              >
                <img
                  src="https://www.svgrepo.com/show/475656/google-color.svg"
                  alt="Google"
                  width="18"
                />
                Google
              </button>
            </div>
          </form>

          {message && (
            <p className="mt-4 px-3 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm">{message}</p>
          )}
          {!message && loading && (
            <p className="mt-2 text-sm text-indigo-600">Verifying credentials...</p>
          )}
        </section>
      </div>
    </div>
  );
}
