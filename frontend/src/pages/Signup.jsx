import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import { motion } from "framer-motion";
import { validatePassword } from "../utils/passwordValidation";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter.jsx";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { COUNSELOR_COLLEGES } from "../constants/counselorColleges";
import buksuLogo from "../assets/buksu-logo.png";

const fieldClass =
  "w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 text-[15px] text-slate-900 shadow-sm transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/[0.06] dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:ring-white/10";

const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2";

function Signup() {
  useDocumentTitle("Sign Up");
  const [signupData, setSignupData] = useState({
    name: "",
    email: "",
    password: "",
    college: "",
  });

  const [passwordErrors, setPasswordErrors] = useState([]);

  const navigate = useNavigate();

  const handleSignupChange = (e) => {
    const { name, value } = e.target;
    const sanitizedValue =
      name === "name" ? value.replace(/[0-9]/g, "") : value;
    setSignupData({ ...signupData, [name]: sanitizedValue });

    if (name === "password") {
      const result = validatePassword(sanitizedValue, {
        email: signupData.email,
        name: signupData.name,
      });
      setPasswordErrors(result.errors);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setPasswordErrors([]);

    const validation = validatePassword(signupData.password, {
      email: signupData.email,
      name: signupData.name,
    });
    if (!validation.isValid) {
      setPasswordErrors(validation.errors);
      Swal.fire({
        icon: "error",
        title: "Password requirements not met",
        html: `<ul style="text-align:left;margin:0;padding-left:1.2rem;">${validation.hints.length > 0 ? validation.hints.map((hint) => `<li>${hint}</li>`).join("") : validation.errors.map((err) => `<li>${err}</li>`).join("")}</ul>`,
      });
      return;
    }
    if (!signupData.college) {
      Swal.fire({
        icon: "error",
        title: "College required",
        text: "Please select the college you counsel for.",
      });
      return;
    }
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth/signup`,
        signupData,
        { headers: { "Content-Type": "application/json" } }
      );

      Swal.fire({
        icon: "success",
        title: "Signup Successful!",
        text: "Your account has been created successfully!",
        timer: 2000,
        showConfirmButton: false,
      });
      console.log(res.data);

      if (res.data?.token) {
        localStorage.setItem("authToken", res.data.token);
        localStorage.setItem("user", JSON.stringify(res.data.user || {}));
      }

      navigate("/login");
    } catch (error) {
      console.error("Signup failed:", error.response?.data || error.message);
      Swal.fire({
        icon: "error",
        title: "Signup Failed",
        text: error.response?.data?.message || error.message,
      });
    }
  };

  const navLinkClass =
    "text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100";

  return (
    <div className="min-h-screen page-bg font-sans text-slate-900 dark:text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6 lg:px-10">
        {/* Top bar — full width, fixed hierarchy */}
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200/70 py-4 dark:border-slate-700/70 sm:py-5">
          <Link to="/login" className={`${navLinkClass} inline-flex items-center gap-2`}>
            <span aria-hidden className="text-base leading-none opacity-70">
              ←
            </span>
            Sign in
          </Link>
          <Link to="/" className={navLinkClass}>
            Home
          </Link>
        </header>

        {/* Main: aside + form — grid on lg, single column stacked on small */}
        <div className="flex flex-1 flex-col gap-10 py-10 sm:gap-12 sm:py-12 lg:grid lg:grid-cols-12 lg:items-start lg:gap-0 lg:py-14 lg:pb-16">
          <motion.aside
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col lg:col-span-5 lg:min-h-0 lg:max-w-lg lg:pr-8 xl:pr-12"
          >
            {/* Primary logo: top of intro column (larger than header mark on lg+) */}
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
              Create your account
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base lg:mt-5">
              Your profile, college affiliation, and a secure password — in one place.
            </p>
            <div
              className="mt-8 hidden h-px w-10 shrink-0 rounded-full bg-slate-300/90 dark:bg-slate-600 lg:mt-10 lg:block"
              aria-hidden
            />
          </motion.aside>

          {/* Form column — centered on mobile, aligned with grid on desktop */}
          <div className="flex flex-1 flex-col lg:col-span-7 lg:min-h-0 lg:justify-start">
            <motion.div
              role="region"
              aria-labelledby="signup-title"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto w-full max-w-md lg:mx-0 lg:ml-auto lg:mr-0"
            >
              <h2 id="signup-title" className="sr-only">
                Counselor sign up form
              </h2>

              <div className="rounded-2xl border border-slate-200/60 bg-white/90 p-7 shadow-[0_1px_0_rgba(15,23,42,0.04),0_24px_48px_-12px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/75 dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.35)] sm:p-9">
                <form onSubmit={handleSignupSubmit} aria-label="Signup form" className="flex flex-col">
                  <section className="space-y-4" aria-labelledby="signup-profile-heading">
                    <div id="signup-profile-heading">
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                        Profile
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Name and email we&apos;ll use for your account.
                      </p>
                    </div>
                    <div className="grid gap-4">
                      <div>
                        <label htmlFor="name" className={labelClass}>
                          Full name
                        </label>
                        <input
                          id="name"
                          name="name"
                          type="text"
                          autoComplete="name"
                          placeholder="e.g. Maria Santos"
                          value={signupData.name}
                          onChange={handleSignupChange}
                          required
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label htmlFor="email" className={labelClass}>
                          Work email
                        </label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          placeholder="name@university.edu.ph"
                          value={signupData.email}
                          onChange={handleSignupChange}
                          required
                          className={fieldClass}
                        />
                      </div>
                    </div>
                  </section>

                  <div className="my-9 h-px w-full bg-slate-100 dark:bg-slate-700/80" aria-hidden />

                  <section className="space-y-4" aria-labelledby="signup-affiliation-heading">
                    <div id="signup-affiliation-heading">
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                        Affiliation
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        College you counsel for.
                      </p>
                    </div>
                    <div>
                      <label htmlFor="college" className={labelClass}>
                        College
                      </label>
                      <select
                        id="college"
                        name="college"
                        value={signupData.college}
                        onChange={handleSignupChange}
                        required
                        className={`${fieldClass} cursor-pointer appearance-none bg-[length:1rem] bg-[right_1rem_center] bg-no-repeat pr-11`}
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                        }}
                      >
                        <option value="" disabled>
                          Select a college
                        </option>
                        {COUNSELOR_COLLEGES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </section>

                  <div className="my-9 h-px w-full bg-slate-100 dark:bg-slate-700/80" aria-hidden />

                  <section className="space-y-4" aria-labelledby="signup-security-heading">
                    <div id="signup-security-heading">
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                        Security
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Choose a strong password you don&apos;t reuse elsewhere.
                      </p>
                    </div>
                    <div>
                      <label htmlFor="password" className={labelClass}>
                        Password
                      </label>
                      <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Create a strong password"
                        value={signupData.password}
                        onChange={handleSignupChange}
                        required
                        className={fieldClass}
                      />
                      <div className="mt-3">
                        <PasswordStrengthMeter
                          password={signupData.password}
                          email={signupData.email}
                          name={signupData.name}
                        />
                      </div>
                      {passwordErrors.length > 0 && (
                        <ul className="mt-3 space-y-1 text-xs leading-relaxed text-red-600 dark:text-red-400">
                          {passwordErrors.map((err) => (
                            <li key={err}>{err}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>

                  <div className="mt-10 space-y-4 sm:mt-11">
                    <button
                      type="submit"
                      className="w-full rounded-xl bg-slate-900 py-3.5 text-[15px] font-medium text-white shadow-sm transition-[transform,box-shadow,background-color] hover:bg-slate-800 hover:shadow-md active:scale-[0.99] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                    >
                      Create account
                    </button>
                    <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                      Already registered?{" "}
                      <Link
                        to="/login"
                        className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 transition-colors hover:decoration-slate-500 dark:text-white dark:decoration-slate-600"
                      >
                        Sign in
                      </Link>
                    </p>
                  </div>
                </form>

                <p className="mt-9 border-t border-slate-100 pt-7 text-center text-[11px] leading-relaxed text-slate-400 dark:border-slate-700 dark:text-slate-500">
                  By creating an account you agree to the terms of use applicable to counselor accounts.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;
