import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import buksuLogo from "../assets/buksu-logo.png";
import sweuLogo from "../assets/SWEU - LOGO.jpeg";
import { AdminMessagesBadgeBadge } from "./NotificationBadge";
import { API_BASE_URL } from "../config/apiBaseUrl";

export default function AdminTopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [admin, setAdmin] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const menuRef = useRef(null);
  const profileRef = useRef(null);

  const fetchAdminProfile = useCallback(async () => {
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) {
        setAdmin(null);
        return;
      }
      const baseUrl = API_BASE_URL;
      const res = await axios.get(`${baseUrl}/api/admin/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      let profile = null;
      if (res.data?.success && res.data?.profile) profile = res.data.profile;
      else if (res.data?.admin) profile = res.data.admin;
      if (profile) {
        setAdmin(profile);
        sessionStorage.setItem("adminProfileCache", JSON.stringify(profile));
      }
    } catch {
      // keep cached admin if any
    }
  }, []);

  // Hydrate from sessionStorage immediately to avoid blank avatar on every nav,
  // then validate from API only ONCE per session.
  useEffect(() => {
    const cached = sessionStorage.getItem("adminProfileCache");
    if (cached) {
      try {
        setAdmin(JSON.parse(cached));
      } catch {
        // ignore parse errors
      }
    }
    if (sessionStorage.getItem("adminProfileSynced") === "1") return;
    sessionStorage.setItem("adminProfileSynced", "1");
    fetchAdminProfile();
  }, [fetchAdminProfile]);

  useEffect(() => {
    const onClickAway = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const navItems = useMemo(
    () => [
      { label: "Dashboard", path: "/admindashboard" },
      { label: "Users", path: "/admin/users" },
      { label: "Records", path: "/admin/records" },
      { label: "Reports", path: "/admin/reports" },
      { label: "Notifications", path: "/admin/notifications" },
      { label: "Backup", path: "/admin/backups" },
      { label: "Messages", path: "/admin/messages", hasAdminMessagesBadge: true },
    ],
    []
  );

  const isActive = useCallback(
    (path) => (path === "/admindashboard" ? location.pathname === "/admindashboard" : location.pathname.startsWith(path)),
    [location.pathname]
  );

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
    if (!result.isConfirmed) return;
    localStorage.removeItem("adminToken");
    sessionStorage.removeItem("adminProfileCache");
    sessionStorage.removeItem("adminProfileSynced");
    navigate("/", { replace: true });
  }, [navigate]);

  const displayName = admin?.name || admin?.email?.split("@")[0] || "Admin";

  // Active link uses the user's chosen primary theme color (CSS variable).
  const activeNavItemStyle = {
    backgroundColor: "var(--theme-primary)",
    color: "var(--theme-primary-contrast, #ffffff)",
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-20 border-b border-gray-200/75 bg-white/95 shadow-[0_1px_0_rgba(0,0,0,0.03),0_8px_30px_rgba(0,0,0,0.06)] backdrop-blur dark:border-gray-700/80 dark:bg-gray-900/95">
      <div className="mx-auto grid h-full w-full max-w-7xl grid-cols-3 items-center px-6 lg:px-8">
        <div className="min-w-0 justify-self-start">
          <Link to="/admindashboard" className="flex min-w-0 items-center gap-2.5 rounded-xl px-1 py-1">
          <img src={sweuLogo} alt="SWEU" className="h-9 w-9 rounded-full border-2 border-white object-cover shadow-sm" />
          <img src={buksuLogo} alt="BuKSU" className="h-9 w-9 object-contain" />
          <div className="hidden min-w-0 xl:block">
            <p className="m-0 truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
              Administration
            </p>
            <p className="m-0 truncate text-sm font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              Admin Console
            </p>
          </div>
          </Link>
        </div>

        <nav className="hidden items-center justify-center gap-2 lg:flex lg:justify-self-center" aria-label="Admin navigation">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`relative inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                isActive(item.path)
                  ? "shadow-sm"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
              style={isActive(item.path) ? activeNavItemStyle : undefined}
            >
              <span className={item.hasAdminMessagesBadge ? "pr-6" : ""}>{item.label}</span>
              {item.hasAdminMessagesBadge ? (
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                  <AdminMessagesBadgeBadge />
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="flex min-w-0 items-center justify-end gap-2 justify-self-end">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition-colors hover:bg-gray-100 md:hidden dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
              onClick={() => setProfileOpen((v) => !v)}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
            >
              <span className="hidden max-w-[9rem] truncate text-xs font-medium text-gray-700 dark:text-gray-200 sm:inline">
                {displayName}
              </span>
              {admin?.profilePicture && !avatarError ? (
                <img
                  src={admin.profilePicture}
                  alt=""
                  className="h-8 w-8 rounded-full border border-gray-200 object-cover dark:border-gray-600"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-100">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </button>

            {profileOpen ? (
              <div className="absolute right-0 mt-2 w-44 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-600 dark:bg-gray-800">
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                  onClick={() => {
                    setProfileOpen(false);
                    navigate("/admin/profile");
                  }}
                >
                  Profile
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/30"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {menuOpen ? (
        <div ref={menuRef} className="border-t border-gray-200/80 px-4 pb-3 pt-2 md:hidden dark:border-gray-700/80">
          <nav className="grid grid-cols-2 gap-2" aria-label="Admin mobile navigation">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMenuOpen(false)}
                className={`relative rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive(item.path)
                    ? ""
                    : "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                }`}
                style={isActive(item.path) ? activeNavItemStyle : undefined}
              >
                <span className={item.hasAdminMessagesBadge ? "pr-6" : ""}>{item.label}</span>
                {item.hasAdminMessagesBadge ? (
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                    <AdminMessagesBadgeBadge />
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
