import { Link } from "react-router-dom";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { initializeTheme } from "../utils/themeUtils";
import { useEffect } from "react";

const cardSurface =
  "rounded-2xl border border-gray-200/90 bg-white shadow-sm dark:border-gray-700/90 dark:bg-gray-800/80";

const features = [
  {
    title: "Record management",
    body: "Create, update, and organize counseling records with a clear, efficient workflow.",
  },
  {
    title: "Analytics & reports",
    body: "Generate reports and review activity so you can focus on outcomes, not paperwork.",
  },
  {
    title: "Notifications",
    body: "Stay informed about records, tasks, and announcements in one place.",
  },
  {
    title: "Cloud integration",
    body: "Connect with Google Drive for secure storage and access when you need it.",
  },
  {
    title: "Security & privacy",
    body: "Built with confidentiality in mind—your clients’ information deserves careful handling.",
  },
  {
    title: "Efficient workflow",
    body: "Reduce repetitive admin work so sessions and follow-ups stay front and center.",
  },
];

const values = [
  {
    title: "Confidentiality",
    body: "We treat sensitive client information with the care and discretion it requires.",
  },
  {
    title: "Efficiency",
    body: "Less time on admin means more time for meaningful guidance and support.",
  },
  {
    title: "Reliability",
    body: "A stable platform you can depend on for day-to-day counseling operations.",
  },
  {
    title: "Innovation",
    body: "We keep improving based on counselor feedback and evolving needs in the field.",
  },
];

export default function AboutUs() {
  useDocumentTitle("About Us");

  useEffect(() => {
    initializeTheme();
  }, []);

  return (
    <div className="min-h-screen w-full page-bg counselor-typography font-sans text-gray-900 dark:text-gray-100">
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <header className="mb-12 border-b border-gray-200/80 pb-10 text-center dark:border-gray-700/80 sm:mb-14 sm:pb-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
            Guidance system
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            About us
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-gray-500 dark:text-gray-400">
            Supporting guidance counselors with thoughtful record management so you can focus on people, not process.
          </p>
        </header>

        <section className="mb-12 sm:mb-14">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Mission
          </h2>
          <div className={`${cardSurface} p-6 sm:p-8`}>
            <p className="text-base leading-relaxed text-gray-600 dark:text-gray-300">
              The Guidance Counsel Record System centralizes session documentation, client context, and follow-ups—so
              counselors spend less energy hunting for information and more time in conversation.
            </p>
            <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-gray-300">
              Our goal is simple: streamline the administrative side of guidance work so quality support stays at the
              center of every day.
            </p>
          </div>
        </section>

        <section className="mb-12 sm:mb-14">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Capabilities
          </h2>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Everything in one calm, organized workspace.
          </p>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {features.map(({ title, body }) => (
              <li key={title} className={`${cardSurface} p-5 sm:p-6`}>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-12 sm:mb-14">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Values
          </h2>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">What guides how we build the product.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {values.map(({ title, body }) => (
              <div key={title} className={`${cardSurface} p-5 sm:p-6`}>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={`${cardSurface} p-6 text-center sm:p-8`}>
          <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white sm:text-xl">
            Ready to get started?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            Create an account or sign in to explore the system.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              to="/signup"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-gray-900 px-6 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              Sign up
            </Link>
            <Link
              to="/login"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-6 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
            >
              Log in
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200/90 bg-white/80 py-8 dark:border-gray-700/90 dark:bg-gray-900/40">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} Collab Project. All rights reserved.
          </p>
          <nav className="flex gap-6 text-xs font-medium">
            <Link
              to="/"
              className="text-gray-500 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Home
            </Link>
            <Link
              to="/about"
              className="text-gray-900 dark:text-white"
            >
              About
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
