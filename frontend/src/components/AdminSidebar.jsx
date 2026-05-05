import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { initializeTheme } from "../utils/themeUtils";
import { AdminMessagesBadgeBadge } from "./NotificationBadge";

export default function AdminSidebar({ variant = "sidebar" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const isHeaderVariant = variant === "header";

  useEffect(() => {
    initializeTheme();
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const handleLogout = useCallback(async () => {
    const result = await Swal.fire({
      title: "Logout?",
      text: "Are you sure you want to log out?",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#4f46e5",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, log out",
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      localStorage.removeItem("adminToken");
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const navItems = [
    { label: "Dashboard", path: "/admindashboard" },
    { label: "User Management", path: "/admin/users" },
    { label: "Notification Center", path: "/admin/notifications" },
    { label: "Messages", path: "/admin/messages", hasAdminMessagesBadge: true },
    { label: "Record Management", path: "/admin/records" },
    { label: "Reports", path: "/admin/reports" },
    { label: "Backup & Restore", path: "/admin/backups" },
    { label: "Profile", path: "/admin/profile" },
  ];

  const navButtonClass = (active) =>
    [
      "relative flex w-full items-center rounded-xl px-3.5 py-3 text-left text-sm font-medium transition-colors",
      active
        ? "bg-indigo-600 text-white shadow-sm dark:bg-indigo-500"
        : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800/90",
    ].join(" ");

  return (
    <aside
      className={
        isHeaderVariant
          ? "relative shrink-0"
          : "h-fit rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm dark:border-gray-700/90 dark:bg-gray-800/95 lg:sticky lg:top-5"
      }
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="admin-navigation-menu"
        aria-label="Toggle admin navigation"
        className={
          isHeaderVariant
            ? "flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition-colors hover:bg-indigo-700 dark:shadow-indigo-950/40"
            : "flex w-full items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/90 px-4 py-3 text-left transition-colors hover:border-gray-200 hover:bg-gray-100/90 dark:border-gray-600/80 dark:bg-gray-700/50 dark:hover:border-gray-500 dark:hover:bg-gray-700"
        }
      >
        {!isHeaderVariant && (
          <div className="min-w-0">
            <h2 className="m-0 text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              Admin Panel
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Open menu</p>
          </div>
        )}
        <span
          className={`${
            isHeaderVariant ? "" : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white"
          } flex flex-col items-center justify-center gap-1.5`}
        >
          <span
            className={`h-0.5 w-[18px] rounded-full bg-current transition-transform ${isOpen ? "translate-y-2 rotate-45" : ""}`}
          />
          <span
            className={`h-0.5 w-[18px] rounded-full bg-current transition-opacity ${isOpen ? "opacity-0" : "opacity-100"}`}
          />
          <span
            className={`h-0.5 w-[18px] rounded-full bg-current transition-transform ${isOpen ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </span>
      </button>

      <div
        className={`fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-[2px] transition-opacity duration-300 dark:bg-black/50 ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      <div
        id="admin-navigation-menu"
        className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-[min(88vw,320px)] flex-col border-r border-gray-200/80 bg-white shadow-xl transition-transform duration-300 ease-out dark:border-gray-700/80 dark:bg-gray-900 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <header className="shrink-0 border-b border-gray-100 px-5 pb-4 pt-5 dark:border-gray-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
                Administration
              </p>
              <h2 className="mt-1.5 m-0 text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                Admin Panel
              </h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Main menu</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              aria-label="Close admin navigation"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            Users, records, reports, notifications, and system tools.
          </p>
        </header>

        <nav className="flex min-h-0 flex-1 flex-col px-3 pb-4 pt-2" aria-label="Admin primary">
          <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain py-1 pr-1">
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => {
                    navigate(item.path);
                    setIsOpen(false);
                  }}
                  className={navButtonClass(active)}
                >
                  <span className={item.hasAdminMessagesBadge ? "pr-8" : ""}>{item.label}</span>
                  {item.hasAdminMessagesBadge ? (
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                      <AdminMessagesBadgeBadge />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="shrink-0 border-t border-gray-100 pt-3 dark:border-gray-800">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center rounded-xl border border-red-200/90 bg-red-50/80 px-3.5 py-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/35 dark:text-red-300 dark:hover:bg-red-950/55"
            >
              Log out
            </button>
          </div>
        </nav>
      </div>
    </aside>
  );
}
