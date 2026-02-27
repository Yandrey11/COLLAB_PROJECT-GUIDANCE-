 import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
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
  const [refreshing, setRefreshing] = useState(false);
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
        const data = res.data;
        setRecords(Array.isArray(data) ? data : data?.records || data?.data || []);
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
                    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
                    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
                    if (!token) return;
                    setRefreshing(true);
                    try {
                      if (calendarConnected) {
                        await axios.post(`${baseUrl}/api/records/sync-google-calendar`, {}, {
                          headers: { Authorization: `Bearer ${token}` },
                        });
                      }
                      const [evRes, recRes] = await Promise.all([
                        axios.get(`${baseUrl}/auth/dashboard/calendar-events`, {
                          headers: { Authorization: `Bearer ${token}` },
                        }),
                        axios.get(`${baseUrl}/api/records`, {
                          headers: { Authorization: `Bearer ${token}` },
                        }),
                      ]);
                      if (evRes.data.connected) {
                        setCalendarEvents(evRes.data.events || []);
                        setCalendarConnected(true);
                      } else {
                        setCalendarEvents([]);
                        setCalendarConnected(false);
                      }
                      const data = recRes.data;
                      setRecords(Array.isArray(data) ? data : data?.records || data?.data || []);
                    } catch (error) {
                      console.error("Error refreshing:", error);
                    } finally {
                      setRefreshing(false);
                    }
                  }}
                  className="px-4 py-2 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 text-sm font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                  disabled={refreshing}
                >
                  {refreshing ? "Refreshing..." : "Refresh"}
              </button>
              </div>
            </div>

            {/* Always show calendar view with records - Google Calendar is optional */}
            {calendarLoading && recordsLoading ? (
              <div className="p-10 text-center bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-700">
                <div className="text-base text-gray-600 dark:text-gray-400 font-semibold mb-2">Loading calendar...</div>
              </div>
            ) : (
              <>
                {!recordsLoading && records.length === 0 && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">
                    No records yet. Create records from the <Link to="/records" className="underline font-medium">Records</Link> page to see them here.
                  </p>
                )}
                <CalendarView 
                  calendarEvents={calendarConnected ? calendarEvents : []}
                  records={records}
                />
              </>
            )}
          </section>

        </main>
      </div>
    </div>
  );
}
