import { useCallback, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import { NotificationBadgeBadge } from "./NotificationBadge";
import { initializeTheme } from "../utils/themeUtils";

export default function CounselorSidebar({ variant = "sidebar" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
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

  // Fetch fresh user info from backend (to get latest permissions)
  const fetchUserInfo = async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      if (!token) {
        const raw = localStorage.getItem("user");
        const parsed = raw ? JSON.parse(raw) : null;
        setUser(parsed);
        return;
      }
      
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.get(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const userData = res.data.user || res.data;
      if (userData && (userData.name || userData.email)) {
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
      }
    } catch (err) {
      console.error("Error fetching user info:", err);
      // Fallback to localStorage
      try {
        const raw = localStorage.getItem("user");
        const parsed = raw ? JSON.parse(raw) : null;
        setUser(parsed);
      } catch {
        setUser(null);
      }
    }
  };

  // Load user from localStorage or fetch from backend
  useEffect(() => {
    fetchUserInfo();
  }, []);

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
      const token = localStorage.getItem("authToken") || localStorage.getItem("token");

      try {
        const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
        if (token) {
          await fetch(`${baseUrl}/api/auth/logout`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          });
        }
      } catch (err) {
        console.error("Error calling logout endpoint:", err);
      }

      localStorage.removeItem("authToken");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      await Swal.fire({
        icon: "info",
        title: "Logged Out",
        text: "You have been logged out!",
        timer: 2000,
        showConfirmButton: false,
      });
      navigate("/", { replace: true });
    }
  }, [navigate]);

  // Helper function to check if user has permission
  const hasPermission = (permission) => {
    if (!user) return false;
    
    // Admins have all permissions
    if (user.role === "admin" || user.permissions?.is_admin === true) {
      return true;
    }
    
    // If permissions field doesn't exist, allow access (backwards compatibility)
    const hasPermissionField = user.permissions && Object.keys(user.permissions).length > 0;
    if (!hasPermissionField) {
      return true; // Backwards compatibility
    }
    
    return user.permissions?.[permission] === true;
  };

  // Navigation items with routes
  const navItems = [
    { label: "Dashboard", path: "/dashboard" },
    {
      label: "Records",
      path: "/records",
      requiresPermission: "can_view_records",
    },
    {
      label: "Reports",
      path: "/reports",
      requiresPermission: "can_view_reports",
    },
    { label: "Notifications", path: "/notifications", hasBadge: true },
    { label: "Profile", path: "/profile" },
  ].filter((item) => {
    // Filter out items that require permissions the user doesn't have
    if (item.requiresPermission) {
      return hasPermission(item.requiresPermission);
    }
    return true;
  });

  // Check if a route is active
  const isActive = (path) => {
    return location.pathname === path;
  };

  const renderNavItems = () => (
    <ul className="m-0 list-none space-y-1 p-0">
      {navItems.map((item) => {
        const active = isActive(item.path);
        return (
          <li key={item.path}>
            <button
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => {
                navigate(item.path);
                setIsOpen(false);
              }}
              className={`relative w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium tracking-tight transition-colors ${
                active
                  ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/55"
              }`}
            >
              <span className={item.hasBadge ? "pr-8" : ""}>{item.label}</span>
              {item.hasBadge ? (
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                  <NotificationBadgeBadge />
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );

  const menuIcon = (
    <span
      className={
        isHeaderVariant
          ? "flex w-5 flex-col items-center justify-center gap-1.5 text-gray-600 dark:text-gray-300"
          : "flex w-5 flex-col items-center justify-center gap-1.5 text-gray-600 dark:text-gray-300"
      }
    >
      <span className={`h-0.5 w-5 rounded-full bg-current transition-transform ${isOpen ? "translate-y-2 rotate-45" : ""}`} />
      <span className={`h-0.5 w-5 rounded-full bg-current transition-opacity ${isOpen ? "opacity-0" : "opacity-100"}`} />
      <span className={`h-0.5 w-5 rounded-full bg-current transition-transform ${isOpen ? "-translate-y-2 -rotate-45" : ""}`} />
    </span>
  );

  return (
    <aside
      className={
        isHeaderVariant
          ? "relative shrink-0"
          : "h-fit rounded-2xl border border-gray-200/90 bg-white p-3 shadow-none dark:border-gray-700/90 dark:bg-gray-800/90 lg:sticky lg:top-5"
      }
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="counselor-navigation-menu"
        aria-label="Toggle counselor navigation"
        className={
          isHeaderVariant
            ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200/90 bg-white text-gray-700 shadow-none transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800/90 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-gray-700/50 sm:h-11 sm:w-11"
            : "flex w-full items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-gray-200 hover:bg-gray-50 dark:hover:border-gray-600 dark:hover:bg-gray-700/35"
        }
      >
        {!isHeaderVariant && (
          <div className="min-w-0">
            <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
              Menu
            </p>
            <h2 className="m-0 mt-0.5 truncate text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              Navigation
            </h2>
          </div>
        )}
        {!isHeaderVariant ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200/90 bg-white dark:border-gray-600 dark:bg-gray-800/90">
            {menuIcon}
          </span>
        ) : (
          menuIcon
        )}
      </button>

      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      <div
        id="counselor-navigation-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Counselor navigation"
        className={`fixed left-0 top-0 z-50 flex h-screen w-[min(88vw,340px)] flex-col border-r border-gray-200/80 bg-white shadow-xl transition-transform duration-300 ease-out dark:border-gray-700/80 dark:bg-gray-900 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <header className="shrink-0 border-b border-gray-100 px-5 pb-5 pt-6 dark:border-gray-800 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                Guidance
              </p>
              <h2 className="m-0 mt-1 text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                Navigation
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200/90 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              aria-label="Close counselor navigation"
            >
              <span className="text-lg font-light leading-none" aria-hidden>
                ×
              </span>
            </button>
          </div>
          <p className="m-0 mt-4 max-w-[280px] text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
            Schedules, sessions, records, and announcements in one place.
          </p>
        </header>

        <nav className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6" aria-label="Main">
          {renderNavItems()}
        </nav>

        <footer className="shrink-0 border-t border-gray-100 px-5 py-5 dark:border-gray-800 sm:px-6">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-xl border border-red-200/90 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-950/35"
          >
            Log out
          </button>
        </footer>
      </div>
    </aside>
  );
}

