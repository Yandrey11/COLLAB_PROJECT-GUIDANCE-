import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { initializeTheme } from "../utils/themeUtils";

export default function AdminSidebar({ variant = "sidebar" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const isHeaderVariant = variant === "header";

  // Initialize theme on mount
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
    { label: "Record Management", path: "/admin/records" },
    { label: "Reports", path: "/admin/reports" },
    { label: "Backup & Restore", path: "/admin/backups" },
    { label: "Profile", path: "/admin/profile" },
  ];

  return (
    <aside
      className={
        isHeaderVariant
          ? "relative shrink-0"
          : "bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm h-fit lg:sticky lg:top-5"
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
            ? "flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 transition-colors"
            : "w-full flex items-center justify-between gap-4 rounded-xl bg-gray-50 dark:bg-gray-700/70 px-4 py-3 text-left hover:bg-indigo-50 dark:hover:bg-gray-700 transition-colors"
        }
      >
        {!isHeaderVariant && (
          <div>
            <h2 className="m-0 text-lg font-bold text-indigo-600 dark:text-indigo-400">Admin Panel</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Menu navigation
            </p>
          </div>
        )}
        <span className={`${isHeaderVariant ? "" : "flex h-10 w-10 shrink-0 rounded-lg bg-indigo-600 shadow-sm"} flex flex-col items-center justify-center gap-1.5 text-white`}>
          <span className={`h-0.5 w-5 rounded-full bg-current transition-transform ${isOpen ? "translate-y-2 rotate-45" : ""}`} />
          <span className={`h-0.5 w-5 rounded-full bg-current transition-opacity ${isOpen ? "opacity-0" : "opacity-100"}`} />
          <span className={`h-0.5 w-5 rounded-full bg-current transition-transform ${isOpen ? "-translate-y-2 -rotate-45" : ""}`} />
        </span>
      </button>

      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      <div
        id="admin-navigation-menu"
        className={`fixed left-0 top-0 z-50 h-screen w-[min(86vw,360px)] bg-white p-5 shadow-2xl transition-transform duration-300 ease-out dark:bg-gray-800 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4 dark:border-gray-700">
          <div>
            <h2 className="m-0 text-xl font-bold text-indigo-600 dark:text-indigo-400">Admin Panel</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Slide navigation
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            aria-label="Close admin navigation"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 my-5">
          Manage users, view analytics, monitor system activity, and configure settings.
        </p>

        <div className="flex flex-col">
          <div className="flex flex-col gap-2 overflow-y-auto pr-1">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  navigate(item.path);
                  setIsOpen(false);
                }}
                className={`p-3 rounded-xl border font-semibold text-left transition-all ${
                  location.pathname === item.path
                    ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                    : "border-indigo-50 dark:border-gray-700 bg-gradient-to-r from-white to-slate-50 dark:from-gray-800 dark:to-gray-700 hover:from-indigo-50 hover:to-white dark:hover:to-gray-700 hover:shadow-sm text-gray-900 dark:text-gray-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="pt-4">
            <button
              onClick={handleLogout}
              className="w-full p-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
