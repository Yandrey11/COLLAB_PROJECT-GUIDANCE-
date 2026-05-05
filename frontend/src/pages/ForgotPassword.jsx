import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { initializeTheme } from "../utils/themeUtils";

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500";
const inputClass =
  "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm transition-all placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400";

export default function ForgotPassword() {
  useDocumentTitle("Forgot Password");
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const isAdmin = returnTo === "admin";
  const loginPath = isAdmin ? "/adminlogin" : "/login";
  const resetPath = isAdmin ? "/reset-password?returnTo=admin" : "/reset-password";

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    initializeTheme();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.post(`${baseUrl}/api/reset/forgot-password`, { email });
      setMessage(res.data.message || "Reset code sent! Check your email.");
      setTimeout(() => navigate(resetPath), 2000);
    } catch (err) {
      console.error("Forgot password error:", err);
      setMessage(err.response?.data?.message || "Failed to send reset code.");
    } finally {
      setLoading(false);
    }
  };

  const messageSuccess = message && !message.includes("Failed");

  return (
    <div className="min-h-screen w-full page-bg counselor-typography font-sans text-gray-900 dark:text-gray-100">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10 sm:px-6 sm:py-12">
        <div className="rounded-2xl border border-gray-200/90 bg-white p-6 shadow-sm dark:border-gray-700/90 dark:bg-gray-800/80 sm:p-8">
          <button
            type="button"
            onClick={() => navigate(loginPath)}
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <span aria-hidden>←</span>
            Back to {isAdmin ? "admin " : ""}login
          </button>

          <div className="mb-8 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
              Account recovery
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
              Forgot password
            </h1>
            <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              {isAdmin
                ? "Enter your admin email. We will send a code you can use on the next step."
                : "Enter your account email. We will send a reset code to your inbox."}
            </p>
          </div>

          {message && (
            <div
              role="status"
              className={`mb-6 rounded-xl border px-4 py-3 text-sm font-medium ${
                messageSuccess
                  ? "border-green-200/90 bg-green-50/90 text-green-800 dark:border-green-800/80 dark:bg-green-950/30 dark:text-green-300"
                  : "border-red-200/90 bg-red-50/90 text-red-800 dark:border-red-800/80 dark:bg-red-950/30 dark:text-red-300"
              }`}
            >
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div>
              <label htmlFor="forgot-email" className={labelClass}>
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-xl bg-gray-900 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              {loading ? "Sending…" : "Send reset code"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Remembered your password?{" "}
            <Link
              to={loginPath}
              className="font-medium text-indigo-600 underline-offset-2 transition hover:text-indigo-500 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
