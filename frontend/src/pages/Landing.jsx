import { Link } from "react-router-dom";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { motion } from "framer-motion";
import landingBg from "../assets/landing-bg.png";
import buksuLogo from "../assets/buksu-logo.png";
import sweuLogo from "../assets/SWEU - LOGO.jpeg";

const heroContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.06 },
  },
};

const heroItem = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function Landing() {
  useDocumentTitle("Home");

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-slate-950 font-sans text-white">
      {/* Background */}
      <img
        src={landingBg}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover opacity-[0.38]"
      />
      <div
        className="absolute inset-0 bg-gradient-to-b from-slate-950/75 via-slate-950/55 to-slate-950/80"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-tr from-indigo-950/40 via-transparent to-violet-950/30"
        aria-hidden
      />

      {/* Header */}
      <header className="relative z-20 border-b border-white/10 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5 lg:px-10">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-3 rounded-lg outline-none ring-offset-2 ring-offset-slate-950 transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="BuKSU Guidance — Student Welfare and Engagement Unit — home"
          >
            {/* Same-size square frames so both marks read equal visually */}
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center sm:h-12 sm:w-12">
              <img
                src={sweuLogo}
                alt="Student Welfare and Engagement Unit — Bukidnon State University"
                width={48}
                height={48}
                className="h-full w-full rounded-full border-[3px] border-white/90 object-cover object-center shadow-md shadow-black/35"
                decoding="async"
              />
            </span>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center sm:h-12 sm:w-12">
              <img
                src={buksuLogo}
                alt="Bukidnon State University"
                width={120}
                height={120}
                className="max-h-full max-w-full object-contain object-center"
                decoding="async"
              />
            </span>
            <span className="hidden text-sm font-semibold tracking-tight text-white/95 sm:inline">
              Guidance
              <span className="font-normal text-white/50"> · </span>
              <span className="font-normal text-white/80">Records</span>
            </span>
          </Link>
          <nav
            className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2 text-sm font-medium text-white/80"
            aria-label="Primary"
          >
            <Link to="/about" className="transition-colors hover:text-white">
              About
            </Link>
            <Link to="/login" className="transition-colors hover:text-white">
              Counselor login
            </Link>
            <Link to="/signup" className="transition-colors hover:text-white">
              Sign up
            </Link>
            <Link
              to="/adminlogin"
              className="text-white/50 transition-colors hover:text-white/90"
            >
              Admin
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex flex-1 flex-col justify-center px-4 py-14 sm:px-6 sm:py-16 lg:px-10 lg:py-20">
        <div className="mx-auto w-full max-w-6xl">
          <motion.div
            className="mx-auto max-w-2xl text-center md:mx-0 md:text-left"
            variants={heroContainer}
            initial="hidden"
            animate="show"
          >
            <motion.div
              variants={heroItem}
              className="mb-6 flex justify-center md:mb-8 md:justify-start"
            >
              <img
                src={sweuLogo}
                alt="Student Welfare and Engagement Unit — Bukidnon State University"
                width={144}
                height={144}
                className="aspect-square h-28 w-28 shrink-0 rounded-full border-[3px] border-white/90 object-cover object-center shadow-xl shadow-black/40 sm:h-32 sm:w-32 lg:h-36 lg:w-36"
                decoding="async"
              />
            </motion.div>

            <motion.p variants={heroItem} className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
              BuKSU · Counselors
            </motion.p>

            <motion.h1
              variants={heroItem}
              className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl lg:mt-5 lg:text-[3.25rem] lg:leading-[1.08]"
            >
              {"Guidance Counselor's"}
              <br />
              <span className="text-white/85">Record System</span>
            </motion.h1>

            <motion.p
              variants={heroItem}
              className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-white/72 md:mx-0 lg:mt-8 lg:text-lg"
            >
              A calm place to manage counseling records, reports, and day-to-day workflows — built for
              your team.
            </motion.p>

            <motion.div
              variants={heroItem}
              className="mt-10 flex flex-col items-stretch gap-3 sm:mt-12 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center md:justify-start"
            >
              <Link
                to="/login"
                className="inline-flex min-h-[3rem] items-center justify-center rounded-xl bg-white px-8 text-[15px] font-medium text-slate-900 shadow-sm transition-[transform,box-shadow,background-color] hover:bg-white/95 hover:shadow-md active:scale-[0.99] sm:min-w-[9.5rem]"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="inline-flex min-h-[3rem] items-center justify-center rounded-xl border border-white/35 bg-white/5 px-8 text-[15px] font-medium text-white backdrop-blur-sm transition-[border-color,background-color] hover:border-white/50 hover:bg-white/10 sm:min-w-[9.5rem]"
              >
                Create account
              </Link>
            </motion.div>

            <motion.p variants={heroItem} className="mt-8 text-sm text-white/50 md:mt-10">
              Administrators use a{" "}
              <Link to="/adminlogin" className="font-medium text-white/70 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white/50">
                separate admin sign-in
              </Link>
              .
            </motion.p>
          </motion.div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/10 px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 text-center text-xs text-white/45 sm:flex-row sm:text-left">
          <p>© {new Date().getFullYear()} Collab Project. All rights reserved.</p>
          <Link to="/about" className="font-medium text-white/55 transition-colors hover:text-white/80">
            About the project
          </Link>
        </div>
      </footer>
    </div>
  );
}
