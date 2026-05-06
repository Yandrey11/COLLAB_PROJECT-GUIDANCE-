import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import CalendarView from "../components/CalendarView";
import CounselorSidebar from "../components/CounselorSidebar";
import CounselorHeaderProfile from "../components/CounselorHeaderProfile.jsx";
import { initializeTheme } from "../utils/themeUtils";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useInactivity } from "../hooks/useInactivity";

const GENERATED_REPORTS_STORAGE_KEY = "counselorGeneratedReports";
const DASHBOARD_CARD_PAGE_SIZE = 3;

const formatDisplayDate = (dateValue) => {
  if (!dateValue) return "No date";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getRecordActivityDate = (record) =>
  record?.auditTrail?.lastModifiedAt ||
  record?.updatedAt ||
  record?.auditTrail?.createdAt ||
  record?.createdAt ||
  record?.date;

const readGeneratedReports = () => {
  try {
    const storedReports = JSON.parse(
      localStorage.getItem(GENERATED_REPORTS_STORAGE_KEY) || "[]"
    );
    return Array.isArray(storedReports) ? storedReports : [];
  } catch {
    return [];
  }
};

const dashboardStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const dashboardItem = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function Dashboard() {
  useDocumentTitle("Dashboard");
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementLoading, setAnnouncementLoading] = useState(false);
  const [announcementPage, setAnnouncementPage] = useState(0);
  const [reportsPage, setReportsPage] = useState(0);
  const [generatedReports, setGeneratedReports] = useState([]);
  const hasAutoSyncedCalendarRef = useRef(false);

  // Initialize inactivity detection
  useInactivity({
    onLogout: () => {
      localStorage.removeItem("token");
      navigate("/login", { replace: true });
    },
    enabled: !!user, // Only enable when user is loaded
  });

  // Fetch Google Calendar events and auto-sync records to Google Calendar
  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

    const fetchCalendarEvents = async (token) => {
      const res = await axios.get(`${baseUrl}/auth/dashboard/calendar-events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.connected) {
        setCalendarEvents(res.data.events || []);
        setCalendarConnected(true);
        return true;
      }
      setCalendarEvents([]);
      setCalendarConnected(false);
      return false;
    };

    const fetchAndMaybeSync = async () => {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      if (!token || !user) {
        setCalendarLoading(false);
        return;
      }
      try {
        setCalendarLoading(true);
        const connected = await fetchCalendarEvents(token);
        if (connected && !hasAutoSyncedCalendarRef.current) {
          hasAutoSyncedCalendarRef.current = true;
          await axios.post(`${baseUrl}/api/records/sync-google-calendar`, {}, {
            headers: { Authorization: `Bearer ${token}` },
          });
          await fetchCalendarEvents(token);
        }
      } catch (error) {
        if (error.response?.status !== 401) {
          console.error("Error fetching calendar events:", error);
        }
        setCalendarEvents([]);
        setCalendarConnected(false);
      } finally {
        setCalendarLoading(false);
      }
    };

    if (user) {
      fetchAndMaybeSync();
      const interval = setInterval(async () => {
        const token = localStorage.getItem("token") || localStorage.getItem("authToken");
        if (token && user) {
          try {
            await fetchCalendarEvents(token);
          } catch {
            // ignore refresh errors
          }
        }
      }, 5 * 60 * 1000);
      return () => clearInterval(interval);
    } else {
      setCalendarLoading(false);
    }
  }, [user]);


  // Initialize theme on mount
  useEffect(() => {
    initializeTheme();
  }, []);

  const hasFetchedRef = useRef(false);

  // Load user and token validation (unchanged backend connection logic)
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    // ✅ Step 1: Immediately store token from URL (Google OAuth redirect) - before any async delay
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromURL = urlParams.get("token");
    if (tokenFromURL) {
      console.log("🔑 Received Google token from URL");
      localStorage.setItem("token", tokenFromURL);
      localStorage.setItem("authToken", tokenFromURL);
      window.history.replaceState({}, document.title, "/dashboard");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      (async () => {
        // ✅ Step 2: Get token (from localStorage or Google)
        const token = localStorage.getItem("token") || localStorage.getItem("authToken");

        if (!token) {
          console.warn("🚫 No token found, redirecting to login...");
          hasFetchedRef.current = false;
          localStorage.removeItem("authToken");
          navigate("/login", { replace: true });
          setLoading(false);
          return;
        }

        try {
          const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
          const res = await fetch(`${baseUrl}/api/auth/me`, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: "Unknown error" }));
            console.warn("🚫 Token validation failed:", res.status, errorData);
            localStorage.removeItem("token");
            localStorage.removeItem("authToken");
            localStorage.removeItem("user");
            hasFetchedRef.current = false;
            navigate("/login", { replace: true });
          } else {
            const data = await res.json();
            const resolvedUser = data.user ?? data;
            console.log("✅ User authenticated successfully:", resolvedUser);
            setUser(resolvedUser);
            localStorage.setItem("user", JSON.stringify(resolvedUser));
          }
        } catch (err) {
          if (err.name !== "AbortError") {
            console.error("❌ Error fetching user from backend:", err);
            localStorage.removeItem("token");
            localStorage.removeItem("authToken");
            localStorage.removeItem("user");
            hasFetchedRef.current = false;
            navigate("/login", { replace: true });
          }
        } finally {
          setLoading(false);
        }
      })();
    }, 100);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []); // Empty deps - run once on mount

  // Listen to storage events so multiple tabs / components can stay in sync
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "user") {
        try {
          const parsed = e.newValue ? JSON.parse(e.newValue) : null;
          setUser(parsed);
        } catch {
          setUser(null);
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const syncGeneratedReports = () => {
      setGeneratedReports(readGeneratedReports());
    };

    syncGeneratedReports();
    window.addEventListener("storage", syncGeneratedReports);
    window.addEventListener("focus", syncGeneratedReports);

    return () => {
      window.removeEventListener("storage", syncGeneratedReports);
      window.removeEventListener("focus", syncGeneratedReports);
    };
  }, []);


  // Fetch records from database — runs on mount and when token is present.
  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

    const fetchRecords = async () => {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      if (!token) {
        setRecords([]);
        setRecordsLoading(false);
        return;
      }
      try {
        setRecordsLoading(true);
        const headers = { Authorization: `Bearer ${token}` };

        const toArray = (payload) =>
          Array.isArray(payload) ? payload : payload?.records || payload?.data || [];

        const [activeRes, archivedRes] = await Promise.allSettled([
          axios.get(`${baseUrl}/api/records`, { headers }),
          axios.get(`${baseUrl}/api/records`, { headers, params: { archived: "true" } }),
        ]);

        const activeRecords =
          activeRes.status === "fulfilled" ? toArray(activeRes.value.data) : [];
        const archivedRecords =
          archivedRes.status === "fulfilled" ? toArray(archivedRes.value.data) : [];

        const seen = new Set();
        const merged = [...activeRecords, ...archivedRecords].filter((record) => {
          const id = record?._id || record?.id;
          if (!id) return true;
          const key = String(id);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setRecords(merged);
      } catch (error) {
        console.error("[Dashboard] Error fetching records:", error);
        setRecords([]);
      } finally {
        setRecordsLoading(false);
      }
    };

    fetchRecords();
    const interval = setInterval(fetchRecords, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      if (!token) {
        setAnnouncements([]);
        return;
      }

      try {
        setAnnouncementLoading(true);
        const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
        const res = await axios.get(`${baseUrl}/api/counselor/notifications/announcements`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        setAnnouncements(Array.isArray(res.data?.announcements) ? res.data.announcements : []);
      } catch (error) {
        console.error("Error fetching announcements:", error);
        setAnnouncements([]);
      } finally {
        setAnnouncementLoading(false);
      }
    };

    fetchAnnouncements();
    const interval = setInterval(fetchAnnouncements, 60_000);
    return () => clearInterval(interval);
  }, [user]);

  const recordSummary = useMemo(() => {
    const statusCount = (statuses) =>
      records.filter((record) => statuses.includes(record.status)).length;

    return {
      total: records.length,
      ongoing: statusCount(["Ongoing"]),
      completed: statusCount(["Completed"]),
      archivedClosed: statusCount(["Archived", "Closed"]),
    };
  }, [records]);

  const recentRecords = useMemo(
    () =>
      [...records]
        .sort((a, b) => {
          const dateA = new Date(getRecordActivityDate(a) || 0).getTime();
          const dateB = new Date(getRecordActivityDate(b) || 0).getTime();
          return dateB - dateA;
        })
        .slice(0, 3),
    [records]
  );

  const announcementTotalPages = Math.max(
    1,
    Math.ceil(announcements.length / DASHBOARD_CARD_PAGE_SIZE)
  );
  const paginatedAnnouncements = useMemo(() => {
    const start = announcementPage * DASHBOARD_CARD_PAGE_SIZE;
    return announcements.slice(start, start + DASHBOARD_CARD_PAGE_SIZE);
  }, [announcements, announcementPage]);

  const reportsTotalPages = Math.max(
    1,
    Math.ceil(generatedReports.length / DASHBOARD_CARD_PAGE_SIZE)
  );
  const paginatedReports = useMemo(() => {
    const start = reportsPage * DASHBOARD_CARD_PAGE_SIZE;
    return generatedReports.slice(start, start + DASHBOARD_CARD_PAGE_SIZE);
  }, [generatedReports, reportsPage]);

  useEffect(() => {
    setAnnouncementPage((p) => Math.min(p, Math.max(0, announcementTotalPages - 1)));
  }, [announcementTotalPages]);

  useEffect(() => {
    setReportsPage((p) => Math.min(p, Math.max(0, reportsTotalPages - 1)));
  }, [reportsTotalPages]);


  const statTiles = [
    {
      label: "Total records",
      value: recordSummary.total,
      accent: "text-indigo-600 dark:text-indigo-400",
    },
    {
      label: "Ongoing",
      value: recordSummary.ongoing,
      accent: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Completed",
      value: recordSummary.completed,
      accent: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Archived / closed",
      value: recordSummary.archivedClosed,
      accent: "text-slate-600 dark:text-slate-300",
    },
  ];

  return (
    <div className="min-h-screen w-full page-bg counselor-typography font-sans text-gray-900 dark:text-gray-100">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <motion.main
          className="min-w-0"
          variants={dashboardStagger}
          initial="hidden"
          animate="show"
        >
          {/* Page intro */}
          <motion.header
            variants={dashboardItem}
            className="mb-8 flex flex-col gap-5 border-b border-gray-200/80 pb-8 dark:border-gray-700/80 sm:flex-row sm:items-center sm:justify-between sm:gap-6 lg:mb-10 lg:pb-10"
          >
            <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-5">
              <CounselorSidebar variant="header" />
              <div className="hidden h-10 w-px shrink-0 bg-gray-200 dark:bg-gray-700 sm:block" aria-hidden />
              <div className="min-w-0">
                <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                  Dashboard
                </p>
                <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 sm:text-3xl">
                  {user?.name ? (
                    <>
                      Welcome back,{" "}
                      <span className="text-gray-700 dark:text-gray-200">{user.name}</span>
                    </>
                  ) : (
                    "Welcome back"
                  )}
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  Sessions, records, reports, and announcements in one place.
                </p>
              </div>
            </div>
            <CounselorHeaderProfile />
          </motion.header>

          <motion.div
            variants={dashboardItem}
            className="grid grid-cols-1 gap-8 xl:grid-cols-12 xl:gap-10 xl:items-start"
          >
            <div className="flex min-w-0 flex-col gap-8 xl:col-span-7 2xl:col-span-8">
              {/* Summary */}
              <section aria-label="Record summary">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                  {statTiles.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-gray-200/90 bg-white px-4 py-4 dark:border-gray-700/90 dark:bg-gray-800/80 sm:px-5 sm:py-5"
                    >
                      <p className="m-0 text-xs font-medium leading-snug text-gray-500 dark:text-gray-400">
                        {item.label}
                      </p>
                      <p
                        className={`mt-3 mb-0 text-2xl font-semibold tabular-nums tracking-tight sm:text-[1.65rem] ${item.accent}`}
                      >
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Recent records */}
              <section className="rounded-2xl border border-gray-200/90 bg-white dark:border-gray-700/90 dark:bg-gray-800/80">
                <div className="flex flex-col gap-1 border-b border-gray-100 px-5 py-5 dark:border-gray-700/80 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
                  <div>
                    <h2 className="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">
                      Recent records
                    </h2>
                    <p className="mt-1.5 m-0 text-sm text-gray-500 dark:text-gray-400">
                      Newest activity across your caseload
                    </p>
                  </div>
                  <Link
                    to="/records"
                    className="mt-2 shrink-0 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 sm:mt-0"
                  >
                    View all →
                  </Link>
                </div>
                <div className="px-2 py-2 sm:px-3 sm:py-3">
                  {recordsLoading ? (
                    <p className="m-0 px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      Loading records…
                    </p>
                  ) : recentRecords.length > 0 ? (
                    <ul className="m-0 list-none space-y-1 p-0">
                      {recentRecords.map((record) => (
                        <li
                          key={record._id || `${record.clientName}-${record.date}`}
                          className="flex items-center justify-between gap-4 rounded-xl px-3 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40 sm:px-4"
                        >
                          <div className="min-w-0">
                            <p className="m-0 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                              {record.clientName || "Unnamed client"}
                            </p>
                            <p className="mt-1 m-0 text-xs text-gray-500 dark:text-gray-400">
                              {formatDisplayDate(getRecordActivityDate(record))}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 dark:border-gray-600 dark:bg-gray-700/60 dark:text-gray-200">
                            {record.status || "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="m-0 px-3 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      No records yet.
                    </p>
                  )}
                </div>
              </section>

              {/* Announcement + reports */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
                <section className="flex flex-col rounded-2xl border border-gray-200/90 bg-white dark:border-gray-700/90 dark:bg-gray-800/80">
                  <div className="flex flex-col gap-1 border-b border-gray-100 px-5 py-5 dark:border-gray-700/80 sm:flex-row sm:items-end sm:justify-between sm:px-6">
                    <div>
                      <h2 className="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">
                        Announcements
                      </h2>
                      <p className="mt-1.5 m-0 text-sm text-gray-500 dark:text-gray-400">
                        Latest from your administrator
                      </p>
                    </div>
                    <Link
                      to="/notifications"
                      className="mt-2 shrink-0 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-400 sm:mt-0"
                    >
                      Inbox →
                    </Link>
                  </div>
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    {announcementLoading ? (
                      <p className="m-0 flex flex-1 items-center justify-center py-8 text-sm text-gray-500 dark:text-gray-400">
                        Loading…
                      </p>
                    ) : paginatedAnnouncements.length > 0 ? (
                      <>
                        <ul className="m-0 flex flex-1 list-none flex-col gap-2 p-0">
                          {paginatedAnnouncements.map((item) => (
                            <li
                              key={item.id || `${item.title}-${item.createdAt}`}
                              className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-4 dark:border-gray-700 dark:bg-gray-900/25"
                            >
                              <h3 className="m-0 text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {item.title}
                              </h3>
                              <p className="mt-2 m-0 text-sm leading-relaxed text-gray-600 dark:text-gray-300 line-clamp-3">
                                {item.description}
                              </p>
                              <p className="mt-3 m-0 text-xs text-gray-400 dark:text-gray-500">
                                {formatDisplayDate(item.createdAt)}
                              </p>
                            </li>
                          ))}
                        </ul>
                        {announcementTotalPages > 1 && (
                          <div
                            className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-700/80"
                            role="navigation"
                            aria-label="Announcements pagination"
                          >
                            <button
                              type="button"
                              className="rounded-lg text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-500 disabled:pointer-events-none disabled:opacity-35 dark:text-indigo-400 dark:hover:text-indigo-300"
                              disabled={announcementPage <= 0}
                              onClick={() => setAnnouncementPage((p) => Math.max(0, p - 1))}
                            >
                              Previous
                            </button>
                            <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                              Page {announcementPage + 1} of {announcementTotalPages}
                            </span>
                            <button
                              type="button"
                              className="rounded-lg text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-500 disabled:pointer-events-none disabled:opacity-35 dark:text-indigo-400 dark:hover:text-indigo-300"
                              disabled={announcementPage >= announcementTotalPages - 1}
                              onClick={() =>
                                setAnnouncementPage((p) =>
                                  Math.min(announcementTotalPages - 1, p + 1)
                                )
                              }
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="m-0 flex flex-1 items-center justify-center py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                        No announcements right now.
                      </p>
                    )}
                  </div>
                </section>

                <section className="flex flex-col rounded-2xl border border-gray-200/90 bg-white dark:border-gray-700/90 dark:bg-gray-800/80">
                  <div className="flex flex-col gap-1 border-b border-gray-100 px-5 py-5 dark:border-gray-700/80 sm:flex-row sm:items-end sm:justify-between sm:px-6">
                    <div>
                      <h2 className="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">
                        Generated reports
                      </h2>
                      <p className="mt-1.5 m-0 text-sm text-gray-500 dark:text-gray-400">
                        Recent PDF exports
                      </p>
                    </div>
                    <Link
                      to="/reports"
                      className="mt-2 shrink-0 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-400 sm:mt-0"
                    >
                      Reports →
                    </Link>
                  </div>
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    {generatedReports.length > 0 ? (
                      <>
                        <ul className="m-0 flex flex-1 list-none flex-col gap-2 p-0">
                          {paginatedReports.map((report) => (
                            <li
                              key={report.id || report.fileName}
                              className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/25"
                            >
                              <p className="m-0 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                                {report.fileName || "Generated report"}
                              </p>
                              <p className="mt-1.5 m-0 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                                {report.reportType || "Report"} · {report.recordCount || 0} record
                                {report.recordCount === 1 ? "" : "s"} ·{" "}
                                {formatDisplayDate(report.generatedAt)}
                              </p>
                            </li>
                          ))}
                        </ul>
                        {reportsTotalPages > 1 && (
                          <div
                            className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-700/80"
                            role="navigation"
                            aria-label="Generated reports pagination"
                          >
                            <button
                              type="button"
                              className="rounded-lg text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-500 disabled:pointer-events-none disabled:opacity-35 dark:text-indigo-400 dark:hover:text-indigo-300"
                              disabled={reportsPage <= 0}
                              onClick={() => setReportsPage((p) => Math.max(0, p - 1))}
                            >
                              Previous
                            </button>
                            <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                              Page {reportsPage + 1} of {reportsTotalPages}
                            </span>
                            <button
                              type="button"
                              className="rounded-lg text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-500 disabled:pointer-events-none disabled:opacity-35 dark:text-indigo-400 dark:hover:text-indigo-300"
                              disabled={reportsPage >= reportsTotalPages - 1}
                              onClick={() =>
                                setReportsPage((p) => Math.min(reportsTotalPages - 1, p + 1))
                              }
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="m-0 flex flex-1 items-center justify-center py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                        No exports yet. Generate a PDF from Reports.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </div>

            {/* Calendar */}
            <section className="min-w-0 rounded-2xl border border-gray-200/90 bg-white dark:border-gray-700/90 dark:bg-gray-800/80 xl:col-span-5 2xl:col-span-4 xl:sticky xl:top-8 xl:self-start">
              <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-5 dark:border-gray-700/80 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <h2 className="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">
                    Calendar
                  </h2>
                  <p className="mt-1.5 m-0 text-sm text-gray-500 dark:text-gray-400">
                    {calendarConnected
                      ? "Records synced with Google Calendar."
                      : "Your records on the calendar."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
                    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
                    if (!token) return;
                    setRefreshing(true);
                    const headers = { Authorization: `Bearer ${token}` };
                    try {
                      if (calendarConnected) {
                        try {
                          await axios.post(`${baseUrl}/api/records/sync-google-calendar`, {}, { headers });
                        } catch (syncError) {
                          console.warn("[Dashboard] calendar sync failed (non-blocking):", syncError?.response?.data || syncError.message);
                        }
                      }
                      try {
                        const evRes = await axios.get(`${baseUrl}/auth/dashboard/calendar-events`, { headers });
                        if (evRes.data?.connected) {
                          setCalendarEvents(evRes.data.events || []);
                          setCalendarConnected(true);
                        } else {
                          setCalendarEvents([]);
                          setCalendarConnected(false);
                        }
                      } catch (eventsError) {
                        console.error("[Dashboard] calendar events refresh failed:", eventsError?.response?.data || eventsError.message);
                      }
                    } finally {
                      setRefreshing(false);
                    }
                  }}
                  className="shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
                  disabled={refreshing}
                >
                  {refreshing ? "Refreshing…" : "Refresh"}
                </button>
              </div>

              <div className="p-4 sm:p-5">
                {calendarLoading && recordsLoading ? (
                  <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                    <p className="m-0 text-sm font-medium text-gray-500 dark:text-gray-400">
                      Loading calendar…
                    </p>
                  </div>
                ) : (
                  <>
                    {!recordsLoading && records.length === 0 && (
                      <p className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200/90">
                        No records yet. Add them on the{" "}
                        <Link to="/records" className="font-medium underline underline-offset-2">
                          Records
                        </Link>{" "}
                        page.
                      </p>
                    )}
                    <CalendarView
                      calendarEvents={calendarConnected ? calendarEvents : []}
                      records={records}
                    />
                  </>
                )}
              </div>
            </section>
          </motion.div>
        </motion.main>
      </div>
    </div>
  );
}
