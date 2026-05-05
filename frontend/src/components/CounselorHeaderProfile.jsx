import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { getCounselorCollegeAvatarRingClass } from "../constants/counselorColleges";

const formatCounselorRole = (role) => {
  if (role === "admin") return "Admin";
  return "Counselor";
};

const readUserFromStorage = () => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * Name + role + avatar for counselor page headers (matches admin header pattern).
 * Loads from localStorage immediately, then refreshes from GET /api/auth/me.
 */
export default function CounselorHeaderProfile({ className = "" }) {
  const location = useLocation();
  const [sessionUser, setSessionUser] = useState(() => readUserFromStorage());
  const [avatarFailed, setAvatarFailed] = useState(false);

  const applyUser = useCallback((u) => {
    if (!u) {
      setSessionUser(null);
      return;
    }
    if (u.name || u.email) {
      setAvatarFailed(false);
      setSessionUser(u);
    } else {
      setSessionUser(null);
    }
  }, []);

  const refreshFromApi = useCallback(async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      if (!token) {
        applyUser(readUserFromStorage());
        return;
      }
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.get(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const u = res.data?.user ?? res.data;
      if (u && (u.name || u.email)) {
        setAvatarFailed(false);
        setSessionUser(u);
        localStorage.setItem("user", JSON.stringify(u));
      } else {
        applyUser(readUserFromStorage());
      }
    } catch {
      applyUser(readUserFromStorage());
    }
  }, [applyUser]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "user" || e.key === null) {
        applyUser(readUserFromStorage());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [applyUser]);

  // Mount + route change: sync from localStorage then API (cross-tab updates use "storage" only).
  useEffect(() => {
    setAvatarFailed(false);
    applyUser(readUserFromStorage());
    refreshFromApi();
  }, [location.pathname, applyUser, refreshFromApi]);

  if (!sessionUser) {
    return null;
  }

  const displayName =
    sessionUser.name?.trim() ||
    (sessionUser.email ? String(sessionUser.email).split("@")[0] : "") ||
    "Counselor";

  const roleLabel = formatCounselorRole(sessionUser.role);
  const metaParts = [roleLabel];
  if (sessionUser.college) metaParts.push(sessionUser.college);
  const metaLine = metaParts.join(" · ");
  const avatarRingClass =
    getCounselorCollegeAvatarRingClass(sessionUser.college) ??
    "border border-gray-200/90 shadow-[0_0_0_1px_rgba(0,0,0,0.04)] dark:border-gray-600 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06)]";

  return (
    <div className={`flex shrink-0 items-center gap-3.5 sm:gap-4 ${className}`}>
      <div className="min-w-0 max-w-[10.5rem] text-right sm:max-w-[15rem]">
        <div className="text-sm font-semibold leading-snug tracking-tight text-gray-900 dark:text-gray-100 sm:text-[0.9375rem]">
          {displayName}
        </div>
        <p
          className="mt-1 line-clamp-1 text-right text-[11px] leading-snug text-gray-500 dark:text-gray-400 sm:text-xs"
          title={metaLine}
        >
          {metaLine}
        </p>
      </div>
      {sessionUser.profilePicture && !avatarFailed ? (
        <img
          src={sessionUser.profilePicture}
          alt=""
          width={44}
          height={44}
          className={`h-10 w-10 shrink-0 rounded-full object-cover sm:h-11 sm:w-11 ${avatarRingClass}`}
          onError={() => setAvatarFailed(true)}
        />
      ) : (
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800/80 sm:h-11 sm:w-11 ${avatarRingClass}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 text-gray-500 dark:text-gray-400 sm:h-[1.35rem] sm:w-[1.35rem]"
            aria-hidden
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      )}
    </div>
  );
}
