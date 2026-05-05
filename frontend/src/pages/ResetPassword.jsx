import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { validatePassword } from "../utils/passwordValidation";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter.jsx";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { initializeTheme } from "../utils/themeUtils";

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500";
const inputClass =
  "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm transition-all placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400";

export default function ResetPassword() {
  useDocumentTitle("Reset Password");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = searchParams.get("returnTo");
  const isAdmin = returnTo === "admin";
  const loginPath = isAdmin ? "/adminlogin" : "/login";

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [useToken, setUseToken] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState([]);

  useEffect(() => {
    initializeTheme();
  }, []);

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    const emailParam = searchParams.get("email");

    if (tokenParam && emailParam) {
      setToken(tokenParam);
      setEmail(emailParam);
      setUseToken(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!newPassword) {
      setMessage("New password is required");
      setLoading(false);
      return;
    }

    const validation = validatePassword(newPassword, { email });
    if (!validation.isValid) {
      setPasswordErrors(validation.errors);
      setMessage("Password does not meet the security requirements.");
      setLoading(false);
      return;
    }

    try {
      const payload = useToken ? { email, token, newPassword } : { email, code, newPassword };

      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.post(`${baseUrl}/api/reset/reset-password`, payload);

      setMessage(res.data.message || "Password reset successful!");
      setTimeout(() => navigate(loginPath), 2000);
    } catch (err) {
      console.error("Reset password error:", err);
      setMessage(err.response?.data?.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  const messageSuccess = message && message.toLowerCase().includes("success");

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
              Security
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
              Reset password
            </h1>
            <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              {useToken
                ? "Choose a new password for your account."
                : "Enter the email and code from your inbox, then choose a new password."}
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
            {!useToken && (
              <>
                <div>
                  <label htmlFor="reset-email" className={labelClass}>
                    Email
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="reset-code" className={labelClass}>
                    Reset code
                  </label>
                  <input
                    id="reset-code"
                    type="text"
                    placeholder="6-digit code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              </>
            )}

            {useToken && (
              <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-300">
                Resetting password for{" "}
                <span className="font-medium text-gray-900 dark:text-white">{email}</span>
              </div>
            )}

            <div>
              <label htmlFor="reset-password" className={labelClass}>
                New password
              </label>
              <input
                id="reset-password"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewPassword(value);
                  const result = validatePassword(value, { email });
                  setPasswordErrors(result.errors);
                }}
                required
                className={inputClass}
              />
              <div className="mt-2">
                <PasswordStrengthMeter password={newPassword} email={email} />
              </div>
              {passwordErrors.length > 0 && (
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-red-600 dark:text-red-400">
                  {passwordErrors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-xl bg-gray-900 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              {loading ? "Updating…" : "Reset password"}
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
