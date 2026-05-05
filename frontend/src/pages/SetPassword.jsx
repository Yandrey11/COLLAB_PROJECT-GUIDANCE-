import { useState, useEffect } from "react";
import axios from "axios";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { validatePassword } from "../utils/passwordValidation";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter.jsx";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { initializeTheme } from "../utils/themeUtils";

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500";
const inputClass =
  "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm transition-all placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400";

export default function SetPassword() {
  useDocumentTitle("Set Password");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [passwordErrors, setPasswordErrors] = useState([]);

  useEffect(() => {
    initializeTheme();
  }, []);

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    const emailParam = searchParams.get("email");

    if (!tokenParam || !emailParam) {
      setMessage("Invalid link. Please contact support.");
      return;
    }

    setToken(tokenParam);
    setEmail(emailParam);
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    if (!newPassword) {
      setMessage("Password is required");
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

    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match");
      setLoading(false);
      return;
    }

    if (!token || !email) {
      setMessage("Invalid link. Please contact support.");
      setLoading(false);
      return;
    }

    try {
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.post(`${baseUrl}/api/reset/set-password`, {
        token,
        email,
        newPassword,
      });

      setMessage(res.data.message || "Password set successfully!");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      console.error("Set password error:", err);
      setMessage(err.response?.data?.message || "Failed to set password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  const messageSuccess =
    message && message.toLowerCase().includes("success");

  return (
    <div className="min-h-screen w-full page-bg counselor-typography font-sans text-gray-900 dark:text-gray-100">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10 sm:px-6 sm:py-12">
        <div className="rounded-2xl border border-gray-200/90 bg-white p-6 shadow-sm dark:border-gray-700/90 dark:bg-gray-800/80 sm:p-8">
          <div className="mb-8 space-y-2 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
              Account setup
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
              Set your password
            </h1>
            {email && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                For <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span>
              </p>
            )}
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
              <label htmlFor="set-password-new" className={labelClass}>
                New password <span className="text-red-500">*</span>
              </label>
              <input
                id="set-password-new"
                type="password"
                value={newPassword}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewPassword(value);
                  const result = validatePassword(value, { email });
                  setPasswordErrors(result.errors);
                }}
                placeholder="Enter a strong password"
                required
                disabled={!token || !email}
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

            <div>
              <label htmlFor="set-password-confirm" className={labelClass}>
                Confirm password <span className="text-red-500">*</span>
              </label>
              <input
                id="set-password-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                disabled={!token || !email}
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !token || !email}
              className="mt-1 h-11 w-full rounded-xl bg-gray-900 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              {loading ? "Saving…" : "Set password"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
            <Link
              to="/login"
              className="font-medium text-indigo-600 underline-offset-2 transition hover:text-indigo-500 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
