 import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import CalendarView from "../components/CalendarView";
import CounselorSidebar from "../components/CounselorSidebar";
import { initializeTheme } from "../utils/themeUtils";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useInactivity } from "../hooks/useInactivity";


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
  const [syncingToGoogle, setSyncingToGoogle] = useState(false);

  // Initialize inactivity detection
  useInactivity({
    onLogout: () => {
      localStorage.removeItem("token");
      navigate("/login", { replace: true });
    },
    enabled: !!user, // Only enable when user is loaded
  });

  // Fetch Google Calendar events
  useEffect(() => {
    const fetchCalendarEvents = async () => {
      try {
        setCalendarLoading(true);
        const token = localStorage.getItem("token") || localStorage.getItem("authToken");
        if (!token || !user) {
          setCalendarLoading(false);
          return;
        }

        const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
        const res = await axios.get(`${baseUrl}/auth/dashboard/calendar-events`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.data.connected) {
          setCalendarEvents(res.data.events || []);
          setCalendarConnected(true);
        } else {
          setCalendarEvents([]);
          setCalendarConnected(false);
        }
      } catch (error) {
        console.error("Error fetching calendar events:", error);
        setCalendarEvents([]);
        setCalendarConnected(false);
      } finally {
        setCalendarLoading(false);
      }
    };

    if (user) {
      fetchCalendarEvents();
      // Auto-refresh calendar every 5 minutes
      const interval = setInterval(fetchCalendarEvents, 5 * 60 * 1000);
      return () => clearInterval(interval);
    } else {
      // User not loaded yet - show calendar with empty data instead of infinite loading
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


  // Fetch records from database
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setRecordsLoading(true);
        const token = localStorage.getItem("token") || localStorage.getItem("authToken");
        if (!token) {
          setRecords([]);
          setRecordsLoading(false);
          return;
        }
        const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
        const res = await axios.get(`${baseUrl}/api/records`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        setRecords(res.data || []);
      } catch (error) {
        console.error("Error fetching records:", error);
        setRecords([]);
      } finally {
        setRecordsLoading(false);
      }
    };

    if (user) {
      fetchRecords();
      // Auto-refresh records every 30 seconds for sync
      const interval = setInterval(fetchRecords, 30000);
      return () => clearInterval(interval);
    } else {
      // User not loaded yet - show calendar with empty data instead of infinite loading
      setRecordsLoading(false);
    }
  }, [user]);


  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 font-sans p-4 md:p-8 gap-6">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        {/* Left: Overview / Navigation */}
        <CounselorSidebar />

        {/* Right: Main content */}
        <main>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 m-0">
                Welcome{user?.name ? `, ${user.name}` : ""} 🎉
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                Manage today's sessions, access records and reports, and view notifications.
              </p>
            </div>
          </div>

          {/* Google Calendar Integration */}
          <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm mb-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 m-0 mb-1">
                  Calendar 
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 m-0">
                  {calendarConnected
                    ? "Your Google Calendar events are shown alongside counseling records. All events and records are read-only."
                    : "View counseling records on the calendar. Sign in with Google to automatically see your Google Calendar events."}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
              <button
                  onClick={async () => {
                    setSyncingToGoogle(true);
                    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
                    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
                    try {
                      const res = await axios.post(`${baseUrl}/api/records/sync-google-calendar`, {}, {
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      if (res.data?.success) {
                        alert(res.data.message || "Records synced to Google Calendar.");
                        setCalendarLoading(true);
                        const evRes = await axios.get(`${baseUrl}/auth/dashboard/calendar-events`, {
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        if (evRes.data.connected) {
                          setCalendarEvents(evRes.data.events || []);
                          setCalendarConnected(true);
                        }
                        const recRes = await axios.get(`${baseUrl}/api/records`, {
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        setRecords(recRes.data || []);
                      }
                    } catch (error) {
                      alert(error.response?.data?.message || "Failed to sync. Sign in with Google to enable.");
                    } finally {
                      setSyncingToGoogle(false);
                      setCalendarLoading(false);
                    }
                  }}
                  className="px-4 py-2 rounded-lg border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 text-sm font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                  disabled={syncingToGoogle}
                >
                  {syncingToGoogle ? "Syncing..." : "Sync Records to Google Calendar"}
                </button>
              {calendarConnected ? (
              <button
                  onClick={async () => {
                    setCalendarLoading(true);
                    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
                    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
                    try {
                      const res = await axios.get(`${baseUrl}/auth/dashboard/calendar-events`, {
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      if (res.data.connected) {
                        setCalendarEvents(res.data.events || []);
                        setCalendarConnected(true);
                      }
                    } catch (error) {
                      console.error("Error refreshing calendar:", error);
                    } finally {
                      setCalendarLoading(false);
                  }
                }}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  disabled={calendarLoading}
                >
                  {calendarLoading ? "Refreshing..." : "Refresh Calendar"}
              </button>
              ) : null}
              </div>
            </div>

            {/* Always show calendar view with records - Google Calendar is optional */}
            {calendarLoading && recordsLoading ? (
              <div className="p-10 text-center bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="text-base text-gray-600 dark:text-gray-400 font-semibold mb-2">Loading calendar...</div>
              </div>
            ) : (
              <CalendarView 
                calendarEvents={calendarConnected ? calendarEvents : []}
                records={records}
              />
            )}
          </section>

        </main>
      </div>
    </div>
  );
}
