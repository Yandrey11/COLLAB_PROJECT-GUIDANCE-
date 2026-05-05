import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import buksuLogo from "../assets/buksu-logo.png";
import sweuLogo from "../assets/SWEU - LOGO.jpeg";
import { MessagesBadgeBadge, NotificationBadgeBadge } from "./NotificationBadge";
import { getCounselorCollegeAvatarRingClass } from "../constants/counselorColleges";

const defaultAvatarRing =
  "border border-gray-200/90 shadow-[0_0_0_1px_rgba(0,0,0,0.04)] dark:border-gray-600 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]";
const COLLEGE_ABBREV = {
  "College of Public Administration and Governance": "CPAG",
  "College of Arts and Sciences": "CAS",
  "College of Business": "COB",
  "College of Education": "COE",
  "College of Law": "COL",
  "College of Nursing": "CON",
  "College of Technologies": "COT",
};

export default function CounselorTopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const menuRef = useRef(null);
  const profileRef = useRef(null);

  const fetchUserInfo = useCallback(async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      if (!token) {
        const raw = localStorage.getItem("user");
        setUser(raw ? JSON.parse(raw) : null);
        return;
      }
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.get(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const nextUser = res.data?.user || res.data;
      if (nextUser && (nextUser.name || nextUser.email)) {
        setUser(nextUser);
        localStorage.setItem("user", JSON.stringify(nextUser));
      }
    } catch {
      try {
        const raw = localStorage.getItem("user");
        setUser(raw ? JSON.parse(raw) : null);
      } catch {
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    fetchUserInfo();
  }, [fetchUserInfo, location.pathname]);

  useEffect(() => {
    const onClickAway = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const navItems = useMemo(
    () => [
      { label: "Dashboard", path: "/dashboard" },
      { label: "Records", path: "/records" },
      { label: "Reports", path: "/reports" },
      { label: "Messages", path: "/messages", hasMessagesBadge: true },
      { label: "Notifications", path: "/notifications", hasBadge: true },
    ],
    []
  );

  const isActive = useCallback(
    (path) => (path === "/records" ? location.pathname.startsWith("/records") : location.pathname === path),
    [location.pathname]
  );

  const displayName =
    user?.name?.trim() || (user?.email ? String(user.email).split("@")[0] : "Counselor");
  const avatarRingClass = getCounselorCollegeAvatarRingClass(user?.college) || defaultAvatarRing;
  const collegeAbbrev = user?.college ? COLLEGE_ABBREV[user.college] || "N/A" : "N/A";
  const profileSubtitle = `${collegeAbbrev} - Counselor`;
  const baseNavItemClass =
    "relative inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-medium transition-colors";
  const activeNavItemClass = "bg-indigo-600 text-white shadow-sm dark:bg-indigo-500";
  const idleNavItemClass = "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800";

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
    } catch {
      // best effort logout
    }

    localStorage.removeItem("authToken");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/", { replace: true });
  }, [navigate]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-20 border-b border-gray-200/75 bg-white/95 shadow-[0_1px_0_rgba(0,0,0,0.03),0_8px_30px_rgba(0,0,0,0.06)] backdrop-blur dark:border-gray-700/80 dark:bg-gray-900/95">
      <div className="mx-auto grid h-full w-full max-w-7xl grid-cols-3 items-center px-6 lg:px-8">
        <div className="min-w-0 justify-self-start">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2.5 rounded-xl px-1 py-1">
          <img
            src={sweuLogo}
            alt="SWEU"
            className="h-9 w-9 rounded-full border-2 border-white object-cover object-center shadow-sm"
          />
          <img src={buksuLogo} alt="BuKSU" className="h-9 w-9 object-contain" />
          <div className="hidden min-w-0 xl:block">
            <p className="m-0 truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
              Counselor
            </p>
            <p className="m-0 truncate text-sm font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              Guidance Records
            </p>
          </div>
          </Link>
        </div>

        <nav className="hidden items-center justify-center gap-2 lg:flex lg:justify-self-center" aria-label="Counselor navigation">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`${baseNavItemClass} ${isActive(item.path) ? activeNavItemClass : idleNavItemClass}`}
            >
              <span className={item.hasBadge || item.hasMessagesBadge ? "pr-6" : ""}>{item.label}</span>
              {item.hasMessagesBadge ? (
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                  <MessagesBadgeBadge />
                </span>
              ) : null}
              {item.hasBadge ? (
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                  <NotificationBadgeBadge />
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
            <span className="sr-only">Menu</span>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-left transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
              onClick={() => setProfileOpen((v) => !v)}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
            >
              <span className="hidden min-w-0 max-w-[9rem] flex-col text-right sm:flex">
                <span className="truncate text-xs font-semibold text-gray-700 dark:text-gray-200">
                  {displayName}
                </span>
                <span className="truncate text-[10px] font-medium tracking-[0.08em] text-gray-500 dark:text-gray-400">
                  {profileSubtitle}
                </span>
              </span>
              {user?.profilePicture && !avatarFailed ? (
                <img
                  src={user.profilePicture}
                  alt=""
                  className={`h-8 w-8 rounded-full object-cover ${avatarRingClass}`}
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-200 ${avatarRingClass}`}
                >
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
                    navigate("/profile");
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
          <nav className="grid grid-cols-2 gap-2" aria-label="Counselor mobile navigation">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMenuOpen(false)}
                className={`relative rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive(item.path)
                    ? "bg-indigo-600 text-white dark:bg-indigo-500"
                    : "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                <span className={item.hasBadge || item.hasMessagesBadge ? "pr-6" : ""}>{item.label}</span>
                {item.hasMessagesBadge ? (
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                    <MessagesBadgeBadge />
                  </span>
                ) : null}
                {item.hasBadge ? (
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                    <NotificationBadgeBadge />
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
