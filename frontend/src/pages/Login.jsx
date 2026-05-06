import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import ReCAPTCHA from "react-google-recaptcha";
import Swal from "sweetalert2";
import { motion } from "framer-motion";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { getRecaptchaSiteKey } from "../config/recaptchaSiteKey.js";
import buksuLogo from "../assets/buksu-logo.png";

const fieldClass =
  "w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 text-[15px] text-slate-900 shadow-sm transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/[0.06] dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:ring-white/10";

const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2";

const navLinkClass =
  "text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100";

function Login() {
  useDocumentTitle("Login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState(null);
  const navigate = useNavigate();

  const recaptchaSiteKey = getRecaptchaSiteKey();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get("error");

    if (error) {
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

    if (!recaptchaSiteKey) {
      Swal.fire({
        icon: "error",
        title: "Configuration Required",
        text: "Set VITE_RECAPTCHA_SITE_KEY in frontend/.env (see .env.example).",
      });
      return;
    }

    if (!recaptchaToken) {
      Swal.fire({
        icon: "warning",
        title: "Verification Required",
        text: "Please complete the reCAPTCHA before logging in.",
      });
      return;
    }

    try {
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.post(`${baseUrl}/api/auth/login`, {
        email,
        password,
        recaptchaToken,
      });

      localStorage.setItem("authToken", res.data.token);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user || res.data.result));
      localStorage.setItem("activeRole", "counselor");
      localStorage.removeItem("themeColors");

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

  const canSubmit = Boolean(recaptchaSiteKey && recaptchaToken);

  return (
    <div className="min-h-screen page-bg font-sans text-slate-900 dark:text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6 lg:px-10">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200/70 py-4 dark:border-slate-700/70 sm:py-5">
          <Link to="/signup" className={`${navLinkClass} inline-flex items-center gap-2`}>
            <span aria-hidden className="text-base leading-none opacity-70">
              ←
            </span>
            Create account
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
                alt="BuKSU Guidance — Record System"
                width={200}
                height={64}
                className="h-11 w-auto max-w-[min(100%,220px)] object-contain object-left sm:h-12 lg:h-[3.25rem]"
                decoding="async"
              />
            </Link>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Counselor access
            </p>
            <h1 className="text-2xl font-semibold leading-snug tracking-tight text-slate-900 dark:text-white sm:text-3xl lg:text-4xl lg:leading-[1.12]">
              Welcome back
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base lg:mt-5">
              Sign in with your work email, then continue to records, reports, and notifications.
            </p>
            <div
              className="mt-8 hidden h-px w-10 shrink-0 rounded-full bg-slate-300/90 dark:bg-slate-600 lg:mt-10 lg:block"
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
              <h2 className="sr-only">Counselor sign in</h2>

              <div className="rounded-2xl border border-slate-200/60 bg-white/90 p-7 shadow-[0_1px_0_rgba(15,23,42,0.04),0_24px_48px_-12px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/75 dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.35)] sm:p-9">
                <form onSubmit={handleSubmit} className="flex flex-col" noValidate>
                  <div className="mb-6">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                      Sign in
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Use the email and password for your counselor account.
                    </p>
                  </div>

                  <div className="grid gap-4">
                    <div>
                      <label htmlFor="email" className={labelClass}>
                        Work email
                      </label>
                      <input
                        id="email"
                        type="email"
                        placeholder="name@university.edu.ph"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <div className="mb-2 flex items-end justify-between gap-3">
                        <label htmlFor="password" className={`${labelClass} mb-0`}>
                          Password
                        </label>
                        <Link
                          to="/forgot-password"
                          className="shrink-0 text-xs font-semibold text-slate-600 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-slate-900 hover:decoration-slate-500 dark:text-slate-400 dark:decoration-slate-600 dark:hover:text-slate-200"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <input
                        id="password"
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

                  <section className="space-y-4" aria-labelledby="login-verify-heading">
                    <div id="login-verify-heading">
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                        Verification
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Confirm you&apos;re human before signing in.
                      </p>
                    </div>
                    {recaptchaSiteKey ? (
                      <div className="flex justify-center overflow-x-auto py-1">
                        <ReCAPTCHA
                          sitekey={recaptchaSiteKey}
                          onChange={(token) => setRecaptchaToken(token)}
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
                        </code>{" "}
                        (see <code className="font-mono text-xs">.env.example</code>).
                      </p>
                    )}
                  </section>

                  <div className="mt-10 space-y-5 sm:mt-11">
                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="w-full rounded-xl bg-slate-900 py-3.5 text-[15px] font-medium text-white shadow-sm transition-[transform,box-shadow,background-color] hover:bg-slate-800 hover:shadow-md enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-slate-900 disabled:hover:shadow-sm dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 dark:disabled:opacity-40"
                    >
                      Sign in
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
                      onClick={() => {
                        const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
                        window.location.href = `${baseUrl}/auth/google`;
                      }}
                      aria-label="Sign in with Google"
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
                      New counselor?{" "}
                      <Link
                        to="/signup"
                        className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 transition-colors hover:decoration-slate-500 dark:text-white dark:decoration-slate-600"
                      >
                        Create an account
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

export default Login;
