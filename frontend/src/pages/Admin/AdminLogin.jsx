import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import ReCAPTCHA from "react-google-recaptcha";
import Swal from "sweetalert2";
import { motion } from "framer-motion";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { getRecaptchaSiteKey } from "../../config/recaptchaSiteKey.js";
import buksuLogo from "../../assets/buksu-logo.png";

const fieldClass =
  "w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 text-[15px] text-slate-900 shadow-sm transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/[0.06] dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:ring-white/10";

const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2";

const navLinkClass =
  "text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100";

export default function AdminLogin() {
  useDocumentTitle("Admin Login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const recaptchaSiteKey = getRecaptchaSiteKey();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!recaptchaSiteKey) {
      await Swal.fire({
        icon: "error",
        title: "Configuration Required",
        text: "Set VITE_RECAPTCHA_SITE_KEY in frontend/.env (see .env.example).",
      });
      return;
    }

    if (!captchaToken) {
      await Swal.fire({
        icon: "warning",
        title: "Verification Required",
        text: "Please complete the reCAPTCHA before signing in.",
      });
      return;
    }

    setLoading(true);

    try {
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.post(`${baseUrl}/api/admin/login`, {
        email,
        password,
        captchaToken,
      });

      if (!res.data.token) {
        setMessage("Login failed: no token received from server.");
        return;
      }

      localStorage.setItem("adminToken", res.data.token);
      localStorage.setItem("admin", JSON.stringify(res.data.admin));
      localStorage.setItem("activeRole", "admin");
      // Clear cached counselor color theme so admin defaults / API values apply
      localStorage.removeItem("themeColors");

      const storedToken = localStorage.getItem("adminToken");
      if (!storedToken) {
        setMessage("Could not store session. Please try again.");
        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Signed in",
        text: "Welcome to the admin dashboard.",
        timer: 2000,
        showConfirmButton: false,
      });
      navigate("/admindashboard", { replace: true });
    } catch (err) {
      console.error("Admin login error:", err);
      setMessage(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    window.location.href = `${baseUrl}/auth/admin/google`;
  };

  const canSubmit = Boolean(recaptchaSiteKey && captchaToken);

  return (
    <div className="min-h-screen page-bg font-sans text-slate-900 dark:text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6 lg:px-10">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200/70 py-4 dark:border-slate-700/70 sm:py-5">
          <Link to="/login" className={`${navLinkClass} inline-flex items-center gap-2`}>
            <span aria-hidden className="text-base leading-none opacity-70">
              ←
            </span>
            Counselor login
          </Link>
          <Link to="/" className={navLinkClass}>
            Home
          </Link>
        </header>

        <div className="flex flex-1 flex-col gap-10 py-10 sm:gap-12 sm:py-12 lg:grid lg:grid-cols-12 lg:items-start lg:gap-0 lg:py-14 lg:pb-16">
          <motion.aside
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col lg:col-span-5 lg:min-h-0 lg:max-w-lg lg:pr-8 xl:pr-12"
          >
            <Link
              to="/"
              className="mb-6 inline-block w-fit rounded-lg outline-none ring-offset-2 ring-offset-transparent transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-slate-400 dark:ring-offset-slate-900 dark:focus-visible:ring-slate-500 sm:mb-7 lg:mb-8"
              aria-label="BuKSU Guidance — home"
            >
              <img
                src={buksuLogo}
                alt=""
                width={200}
                height={64}
                className="h-11 w-auto max-w-[min(100%,220px)] object-contain object-left sm:h-12 lg:h-[3.25rem]"
                decoding="async"
              />
            </Link>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600/90 dark:text-violet-400">
              Administrator
            </p>
            <h1 className="text-2xl font-semibold leading-snug tracking-tight text-slate-900 dark:text-white sm:text-3xl lg:text-4xl lg:leading-[1.12]">
              Admin sign-in
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base lg:mt-5">
              Restricted access for system administrators. Use your admin email, password, and verification below.
            </p>
            <div
              className="mt-8 hidden h-px w-10 shrink-0 rounded-full bg-violet-300/80 dark:bg-violet-600/60 lg:mt-10 lg:block"
              aria-hidden
            />
          </motion.aside>

          <div className="flex flex-1 flex-col lg:col-span-7 lg:min-h-0 lg:justify-start">
            <motion.div
              role="main"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto w-full max-w-md lg:mx-0 lg:ml-auto lg:mr-0"
            >
              <h2 className="sr-only">Administrator sign in</h2>

              <div className="rounded-2xl border border-slate-200/60 bg-white/90 p-7 shadow-[0_1px_0_rgba(15,23,42,0.04),0_24px_48px_-12px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/75 dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.35)] sm:p-9">
                <form onSubmit={handleSubmit} className="flex flex-col" noValidate>
                  <div className="mb-6">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                      Credentials
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Admin email and password issued to your role.
                    </p>
                  </div>

                  <div className="grid gap-4">
                    <div>
                      <label htmlFor="admin-email" className={labelClass}>
                        Admin email
                      </label>
                      <input
                        id="admin-email"
                        type="email"
                        placeholder="admin@organization.edu.ph"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <div className="mb-2 flex items-end justify-between gap-3">
                        <label htmlFor="admin-password" className={`${labelClass} mb-0`}>
                          Password
                        </label>
                        <Link
                          to="/forgot-password?returnTo=admin"
                          className="shrink-0 text-xs font-semibold text-slate-600 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-slate-900 hover:decoration-slate-500 dark:text-slate-400 dark:decoration-slate-600 dark:hover:text-slate-200"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <input
                        id="admin-password"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        className={fieldClass}
                      />
                    </div>
                  </div>

                  <div className="my-9 h-px w-full bg-slate-100 dark:bg-slate-700/80" aria-hidden />

                  <section className="space-y-4" aria-labelledby="admin-verify-heading">
                    <div id="admin-verify-heading">
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                        Verification
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Complete reCAPTCHA before signing in.
                      </p>
                    </div>
                    {recaptchaSiteKey ? (
                      <div className="flex justify-center overflow-x-auto py-1">
                        <ReCAPTCHA
                          sitekey={recaptchaSiteKey}
                          onChange={(token) => setCaptchaToken(token || "")}
                        />
                      </div>
                    ) : (
                      <p className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm leading-relaxed text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100">
                        reCAPTCHA is not configured. Add{" "}
                        <code className="rounded bg-amber-100/80 px-1.5 py-0.5 font-mono text-xs dark:bg-amber-900/50">
                          VITE_RECAPTCHA_SITE_KEY
                        </code>{" "}
                        to{" "}
                        <code className="rounded bg-amber-100/80 px-1.5 py-0.5 font-mono text-xs dark:bg-amber-900/50">
                          frontend/.env
                        </code>
                        .
                      </p>
                    )}
                  </section>

                  {message ? (
                    <div
                      className="mt-6 rounded-xl border border-red-200/90 bg-red-50/90 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
                      role="alert"
                    >
                      {message}
                    </div>
                  ) : null}

                  <div className="mt-8 space-y-5 sm:mt-9">
                    <button
                      type="submit"
                      disabled={loading || !canSubmit}
                      className="w-full rounded-xl bg-slate-900 py-3.5 text-[15px] font-medium text-white shadow-sm transition-[transform,box-shadow,background-color] hover:bg-slate-800 hover:shadow-md enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-slate-900 disabled:hover:shadow-sm dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 dark:disabled:opacity-40"
                    >
                      {loading ? "Signing in…" : "Sign in to dashboard"}
                    </button>

                    <div className="relative flex items-center gap-3 py-1">
                      <span className="h-px flex-1 bg-slate-100 dark:bg-slate-700" aria-hidden />
                      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                        or
                      </span>
                      <span className="h-px flex-1 bg-slate-100 dark:bg-slate-700" aria-hidden />
                    </div>

                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200/90 bg-white py-3 text-sm font-semibold text-slate-800 shadow-sm transition-[border-color,background-color] hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-800/60"
                      onClick={handleGoogleLogin}
                      aria-label="Sign in with Google as admin"
                    >
                      <img
                        src="https://www.svgrepo.com/show/475656/google-color.svg"
                        alt=""
                        width={18}
                        height={18}
                        className="shrink-0"
                      />
                      Continue with Google
                    </button>

                    <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                      Not an admin?{" "}
                      <Link
                        to="/login"
                        className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 transition-colors hover:decoration-slate-500 dark:text-white dark:decoration-slate-600"
                      >
                        Counselor login
                      </Link>
                    </p>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
