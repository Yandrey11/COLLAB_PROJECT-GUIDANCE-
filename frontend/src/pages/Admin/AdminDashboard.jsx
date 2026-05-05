import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import { motion, AnimatePresence } from "framer-motion";
import AdminSidebar from "../../components/AdminSidebar";
import { initializeTheme } from "../../utils/themeUtils";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { useInactivity } from "../../hooks/useInactivity";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Helper function to get full image URL from backend
const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  // If it's already a full URL (http/https), return as is
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  // If it's a data URL (base64), return as is
  if (imagePath.startsWith("data:")) {
    return imagePath;
  }
  // Otherwise, prepend the backend URL
  const path = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  return `${BASE_URL}${path}`;
};

export default function AdminDashboard() {
  useDocumentTitle("Admin Dashboard");
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // Summary & activity
  const [summary, setSummary] = useState({
    totalUsers: "—",
    totalAdmins: "—",
    totalCounselors: "—",
    active: "—",
    inactive: "—",
    recentActivity: [],
  });

  // Notifications (polled)
  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const notificationsIntervalRef = useRef(null);
  const summaryIntervalRef = useRef(null);

  // Analytics data
  const [analyticsOverview, setAnalyticsOverview] = useState({
    totalRecords: 0,
    recordsCreatedInRange: 0,
    totalPDFsGenerated: 0,
    totalDriveUploads: 0,
    activeCounselorsThisWeek: 0,
    totalPageVisits: 0,
    activeUsers: 0,
  });
  const [dailyRecords, setDailyRecords] = useState([]);
  const [pageVisits, setPageVisits] = useState({ byPage: [], daily: [] });
  const [recordStatusDistribution, setRecordStatusDistribution] = useState([]);
  const [problemsPresentedDistribution, setProblemsPresentedDistribution] = useState([]);
  const [genderDistribution, setGenderDistribution] = useState([]);
  const [courseDistribution, setCourseDistribution] = useState([]);
  const [chartPeriod, setChartPeriod] = useState("daily");
  const [distributionBucketLabel, setDistributionBucketLabel] = useState({
    problems: null,
    gender: null,
    course: null,
  });
  const [recentEvents, setRecentEvents] = useState([]);
  const [recentEventsPage, setRecentEventsPage] = useState(1);
  const [recentEventsTotalPages, setRecentEventsTotalPages] = useState(1);
  const [dateRange, setDateRange] = useState("30d");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [pageNameFilter, setPageNameFilter] = useState("");
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  /** Consultation (record) volume by month/quarter and session type */
  const [consultationVolume, setConsultationVolume] = useState({
    byMonth: [],
    byQuarter: [],
    peakMonth: null,
    categories: ["Individual", "Group", "Face to Face", "Online", "Other"],
  });
  const [consultationPeriodView, setConsultationPeriodView] = useState("month");

  // Announcement modal state
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementData, setAnnouncementData] = useState({
    title: "",
    message: "",
    priority: "medium",
    targetAudience: "all", // "all" or "specific"
    selectedCounselorIds: [],
  });
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const [counselors, setCounselors] = useState([]);
  const [loadingCounselors, setLoadingCounselors] = useState(false);

  // Initialize inactivity detection
  useInactivity({
    onLogout: () => {
      localStorage.removeItem("adminToken");
      navigate("/adminlogin", { replace: true });
    },
    enabled: !!admin, // Only enable when admin is loaded
  });

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme();
  }, []);

  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // Prevent double-fetch (e.g. from React StrictMode or re-mounts)
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get("token");

    if (tokenFromUrl) {
      // after successful login (backend redirect with token) we persist and normalize URL
      localStorage.setItem("adminToken", tokenFromUrl);
      window.history.replaceState({}, document.title, "/admindashboard");
    }

    const fetchAdmin = async () => {
      const token = localStorage.getItem("adminToken");
      
      try {
        // main verification (do not change endpoint)
        console.log("📤 Sending request to /api/admin/dashboard");
        const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
        const res = await axios.get(`${baseUrl}/api/admin/dashboard`, {
          headers: token ? { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          } : {
            "Content-Type": "application/json"
          },
        });
        console.log("✅ Dashboard response received:", res.data);

        // If user is not admin -> Access Denied UI then redirect
        if (res.data.role !== "admin") {
          setAccessDenied(true);
          localStorage.removeItem("adminToken");
          // show a brief Access Denied message before redirecting
          setTimeout(() => {
            navigate("/login", { replace: true });
          }, 2500);
          return;
        }

        // verified admin: store admin object and then load dashboard data
        setAdmin(res.data);

        // fetch summary and start notifications polling
        await Promise.all([fetchSummary(token)]);
        startNotificationsPolling(token);
        startSummaryPolling(token); // Start polling for recent activities
        fetchAnalyticsData(token); // Fetch analytics data
      } catch (err) {
        console.error("❌ Admin verification failed:", err);
        console.error("❌ Error response:", err.response?.data);
        console.error("❌ Error status:", err.response?.status);
        console.error("❌ Error headers:", err.response?.headers);
        if (err.response?.data?.message) {
          Swal.fire({
            icon: "error",
            title: "Error",
            text: err.response.data.message,
          });
        }
        localStorage.removeItem("adminToken");
        hasFetchedRef.current = false; // Allow retry after redirect to login
        navigate("/adminlogin", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    fetchAdmin();

    return () => {
      // cleanup polling
      if (notificationsIntervalRef.current) clearInterval(notificationsIntervalRef.current);
      if (summaryIntervalRef.current) clearInterval(summaryIntervalRef.current);
    };
  }, []); // Empty deps - run once on mount; navigate is stable

  // Fetch overview/summary (uses a dedicated endpoint if available)
  const fetchSummary = async (token) => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.get(`${baseUrl}/api/admin/summary`, {
        headers: token ? { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        } : {
          "Content-Type": "application/json"
        },
      });
      // expected: { totalUsers, totalAdmins, totalCounselors, active, inactive, recentActivity: [] }
      setSummary((prev) => ({ ...prev, ...res.data }));
    } catch (err) {
      // If endpoint missing, keep defaults; optionally fallback to minimal values from dashboard response
      console.warn("Could not fetch summary:", err.message || err);
    }
  };


  // Notifications polling to provide near-real-time alerts
  const startNotificationsPolling = (token) => {
    const poll = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
        const res = await axios.get(`${baseUrl}/api/admin/notifications`, {
          headers: token ? { 
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          } : {
            "Content-Type": "application/json"
          },
          params: { page: 1, limit: 5, status: "unread" },
        });
        setNotifications(res.data.notifications || []);
        setUnreadNotificationCount(res.data.unreadCount || 0);
      } catch (err) {
        console.warn("Notifications polling failed:", err.message || err);
      }
    };
    // initial fetch
    poll();
    // poll every 10 seconds
    notificationsIntervalRef.current = setInterval(poll, 10000);
  };

  // Summary polling to refresh recent activities
  const startSummaryPolling = (token) => {
    const poll = async () => {
      try {
        await fetchSummary(token);
      } catch (err) {
        console.warn("Summary polling failed:", err.message || err);
      }
    };
    // poll every 15 seconds to refresh recent activities
    summaryIntervalRef.current = setInterval(poll, 15000);
  };

  // Fetch analytics data
  const fetchAnalyticsData = async (token) => {
    try {
      setAnalyticsLoading(true);

      // Fetch overview
      const overviewRes = await axios.get(`${BASE_URL}/api/admin/analytics/overview`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { range: dateRange },
      });
      if (overviewRes.data.success && overviewRes.data.overview) {
        setAnalyticsOverview(overviewRes.data.overview);
      }

      // Fetch records trend by selected period
      const dailyRes = await axios.get(`${BASE_URL}/api/admin/analytics/record-volume`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { range: dateRange, period: chartPeriod },
      });
      if (dailyRes.data.success) {
        setDailyRecords(dailyRes.data.series || []);
      }

      // Fetch page visits
      const pageVisitsRes = await axios.get(`${BASE_URL}/api/admin/analytics/page-visits`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { range: dateRange, pageName: pageNameFilter || undefined },
      });
      if (pageVisitsRes.data.success) {
        setPageVisits(pageVisitsRes.data.pageVisits);
      }

      // Fetch record status distribution
      const statusRes = await axios.get(`${BASE_URL}/api/admin/analytics/record-status-distribution`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (statusRes.data.success) {
        setRecordStatusDistribution(statusRes.data.distribution);
      }

      const [problemsRes, genderRes, courseRes] = await Promise.allSettled([
        axios.get(`${BASE_URL}/api/admin/analytics/problems-presented`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { range: dateRange, period: chartPeriod },
        }),
        axios.get(`${BASE_URL}/api/admin/analytics/gender-distribution`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { range: dateRange, period: chartPeriod },
        }),
        axios.get(`${BASE_URL}/api/admin/analytics/course-distribution`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { range: dateRange, period: chartPeriod },
        }),
      ]);

      if (problemsRes.status === "fulfilled" && problemsRes.value.data?.success) {
        setProblemsPresentedDistribution(problemsRes.value.data.distribution || []);
      } else {
        setProblemsPresentedDistribution([]);
      }
      if (genderRes.status === "fulfilled" && genderRes.value.data?.success) {
        setGenderDistribution(genderRes.value.data.distribution || []);
      } else {
        setGenderDistribution([]);
      }
      if (courseRes.status === "fulfilled" && courseRes.value.data?.success) {
        setCourseDistribution(courseRes.value.data.distribution || []);
      } else {
        setCourseDistribution([]);
      }
      setDistributionBucketLabel({
        problems:
          problemsRes.status === "fulfilled" ? problemsRes.value.data?.bucketLabel || null : null,
        gender:
          genderRes.status === "fulfilled" ? genderRes.value.data?.bucketLabel || null : null,
        course:
          courseRes.status === "fulfilled" ? courseRes.value.data?.bucketLabel || null : null,
      });

      const volRes = await axios.get(`${BASE_URL}/api/admin/analytics/consultation-volume`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { range: dateRange },
      });
      if (volRes.data?.success) {
        setConsultationVolume({
          byMonth: volRes.data.byMonth || [],
          byQuarter: volRes.data.byQuarter || [],
          peakMonth: volRes.data.peakMonth ?? null,
          categories: volRes.data.categories || [
            "Individual",
            "Group",
            "Face to Face",
            "Online",
            "Other",
          ],
        });
      }

      // Fetch recent events
      const eventsRes = await axios.get(`${BASE_URL}/api/admin/analytics/events`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          range: dateRange,
          eventType: eventTypeFilter || undefined,
          pageName: pageNameFilter || undefined,
          page: recentEventsPage,
          limit: 3,
        },
      });
      if (eventsRes.data.success) {
        setRecentEvents(eventsRes.data.events);
        if (eventsRes.data.pagination) {
          setRecentEventsTotalPages(eventsRes.data.pagination.pages || 1);
        }
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Fetch counselors for selection
  const fetchCounselors = async () => {
    try {
      setLoadingCounselors(true);
      const token = localStorage.getItem("adminToken");
      
      const response = await axios.get(`${BASE_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          role: "counselor",
          limit: 100, // Get all counselors
          page: 1,
        },
      });

      if (response.data && response.data.users) {
        setCounselors(response.data.users);
      }
    } catch (error) {
      console.error("❌ Error fetching counselors:", error);
    } finally {
      setLoadingCounselors(false);
    }
  };

  // Open announcement modal and fetch counselors
  const handleOpenAnnouncementModal = () => {
    setShowAnnouncementModal(true);
    fetchCounselors();
  };

  // Send announcement to counselors
  const sendAnnouncement = async () => {
    if (!announcementData.title.trim() || !announcementData.message.trim()) {
      Swal.fire({
        icon: "error",
        title: "Validation Error",
        text: "Please fill in both title and message fields.",
      });
      return;
    }

    if (announcementData.targetAudience === "specific" && announcementData.selectedCounselorIds.length === 0) {
      Swal.fire({
        icon: "error",
        title: "Validation Error",
        text: "Please select at least one counselor.",
      });
      return;
    }

    try {
      setSendingAnnouncement(true);
      const token = localStorage.getItem("adminToken");
      
      const payload = {
        title: announcementData.title.trim(),
        message: announcementData.message.trim(),
        priority: announcementData.priority,
        targetAudience: announcementData.targetAudience,
      };

      if (announcementData.targetAudience === "specific") {
        payload.targetCounselorIds = announcementData.selectedCounselorIds;
      }

      const response = await axios.post(
        `${BASE_URL}/api/admin/announcements`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.message) {
        const audienceText = announcementData.targetAudience === "all" 
          ? "all counselors" 
          : `${announcementData.selectedCounselorIds.length} selected counselor(s)`;
        
        Swal.fire({
          icon: "success",
          title: "Success!",
          text: `Announcement sent to ${audienceText} successfully.`,
          timer: 2000,
          showConfirmButton: false,
        });

        // Reset form
        setAnnouncementData({
          title: "",
          message: "",
          priority: "medium",
          targetAudience: "all",
          selectedCounselorIds: [],
        });
        setShowAnnouncementModal(false);
      }
    } catch (error) {
      console.error("❌ Error sending announcement:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "Failed to send announcement. Please try again.",
      });
    } finally {
      setSendingAnnouncement(false);
    }
  };

  // Refetch analytics when filters or page changes
  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (token && admin) {
      fetchAnalyticsData(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, chartPeriod, eventTypeFilter, pageNameFilter, recentEventsPage]);

  const handleLogout = async () => {
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
  };


  const cardSurface =
    "rounded-2xl border border-gray-200/90 bg-white shadow-sm dark:border-gray-700/90 dark:bg-gray-800/80";
  const selectField =
    "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400";
  const filterLabel =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500";

  if (accessDenied) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gradient-to-b from-gray-50 to-gray-100 px-6 text-center dark:from-gray-900 dark:to-gray-950 counselor-typography font-sans">
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Access denied</h2>
        <p className="max-w-md text-sm text-gray-600 dark:text-gray-400">
          You do not have permission to access the admin dashboard. Redirecting…
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center page-bg counselor-typography font-sans">
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-600 dark:border-gray-600 dark:border-t-indigo-400"
            aria-hidden
          />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full page-bg counselor-typography font-sans text-gray-900 dark:text-gray-100">
      <AdminSidebar />
      <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className={`${cardSurface} p-5 sm:p-6`}
            >
              <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">Analytics</h2>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Date range and filters apply to charts and the activity log below.
                  </p>
                </div>
                {analyticsLoading && (
                  <span className="text-xs font-medium text-gray-400 dark:text-gray-500">Refreshing…</span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label htmlFor="admin-dash-range" className={filterLabel}>
                    Date range
                  </label>
                  <select
                    id="admin-dash-range"
                    value={dateRange}
                    onChange={(e) => {
                      setDateRange(e.target.value);
                      setRecentEventsPage(1);
                    }}
                    className={selectField}
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="1y">Last year</option>
                    <option value="2y">Last 2 years</option>
                    <option value="all">Last 5 years</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="admin-dash-event" className={filterLabel}>
                    Event type
                  </label>
                  <select
                    id="admin-dash-event"
                    value={eventTypeFilter}
                    onChange={(e) => {
                      setEventTypeFilter(e.target.value);
                      setRecentEventsPage(1);
                    }}
                    className={selectField}
                  >
                    <option value="">All events</option>
                    <option value="record_created">Records created</option>
                    <option value="record_updated">Records updated</option>
                    <option value="pdf_generated">PDFs generated</option>
                    <option value="drive_uploaded">Drive uploads</option>
                    <option value="page_visit">Page visits</option>
                    <option value="user_login">User logins</option>
                  </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-1">
                  <label htmlFor="admin-dash-page" className={filterLabel}>
                    Page
                  </label>
                  <select
                    id="admin-dash-page"
                    value={pageNameFilter}
                    onChange={(e) => {
                      setPageNameFilter(e.target.value);
                      setRecentEventsPage(1);
                    }}
                    className={selectField}
                  >
                    <option value="">All pages</option>
                    <option value="Dashboard">Dashboard</option>
                    <option value="Records Page">Records page</option>
                    <option value="Reports Page">Reports page</option>
                    <option value="Notification Center">Notification center</option>
                    <option value="Settings">Settings</option>
                  </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-1">
                  <label htmlFor="admin-dash-period" className={filterLabel}>
                    Chart period
                  </label>
                  <div
                    id="admin-dash-period"
                    className="inline-flex h-10 w-full items-center rounded-lg border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-700"
                  >
                    {[
                      { id: "daily", label: "Daily" },
                      { id: "monthly", label: "Monthly" },
                      { id: "quarterly", label: "Quarterly" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setChartPeriod(opt.id)}
                        className={`h-full flex-1 rounded-md px-2 text-xs font-medium transition-colors ${
                          chartPeriod === opt.id
                            ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                            : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-600"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className={`${cardSurface} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700/80">
                  <svg className="h-5 w-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Announcements</h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                    Push a notification to all counselors or to a chosen list.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenAnnouncementModal}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white sm:ml-4"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New announcement
              </button>
            </motion.div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <SummaryCard
                title="Total records"
                value={analyticsOverview.totalRecords.toLocaleString()}
                accent="indigo"
                onClick={() => navigate("/admin/records")}
              />
              <SummaryCard
                title="PDFs generated"
                value={analyticsOverview.totalPDFsGenerated.toLocaleString()}
                accent="emerald"
                onClick={() => navigate("/admin/reports")}
              />
              <SummaryCard
                title="Drive uploads"
                value={analyticsOverview.totalDriveUploads.toLocaleString()}
                accent="violet"
                onClick={() => navigate("/admin/records")}
              />
              <SummaryCard
                title="Active counselors (week)"
                value={analyticsOverview.activeCounselorsThisWeek.toLocaleString()}
                accent="amber"
                onClick={() => navigate("/admin/users")}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <ChartCard title={`Records trend (${chartPeriod})`}>
                <LineChart data={dailyRecords} period={chartPeriod} />
              </ChartCard>
              <ChartCard title="Record status distribution">
                <PieChart data={recordStatusDistribution} />
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <ChartCard
                title={`Problems presented${distributionBucketLabel.problems ? ` (${distributionBucketLabel.problems})` : ""}`}
              >
                <DistributionPieChart data={problemsPresentedDistribution} />
              </ChartCard>
              <ChartCard
                title={`Gender distribution${distributionBucketLabel.gender ? ` (${distributionBucketLabel.gender})` : ""}`}
              >
                <DistributionPieChart data={genderDistribution} />
              </ChartCard>
              <ChartCard
                title={`Course distribution${distributionBucketLabel.course ? ` (${distributionBucketLabel.course})` : ""}`}
              >
                <DistributionPieChart data={courseDistribution} />
              </ChartCard>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`${cardSurface} p-5 sm:p-6`}
            >
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="m-0 text-sm font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                    Consultations by session type
                  </h3>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Counseling records in the selected date range, stacked by session category.
                  </p>
                  {consultationVolume.peakMonth && consultationPeriodView === "month" ? (
                    <p className="mt-2 m-0 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      Highest month:{" "}
                      <span className="text-gray-900 dark:text-gray-100">
                        {consultationVolume.peakMonth.label}
                      </span>{" "}
                      ({consultationVolume.peakMonth.total.toLocaleString()} consultations)
                    </p>
                  ) : null}
                </div>
                <div
                  className="flex shrink-0 rounded-xl border border-gray-200 p-0.5 dark:border-gray-600"
                  role="group"
                  aria-label="Period grouping"
                >
                  <button
                    type="button"
                    onClick={() => setConsultationPeriodView("month")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      consultationPeriodView === "month"
                        ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                        : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/80"
                    }`}
                  >
                    By month
                  </button>
                  <button
                    type="button"
                    onClick={() => setConsultationPeriodView("quarter")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      consultationPeriodView === "quarter"
                        ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                        : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/80"
                    }`}
                  >
                    By quarter
                  </button>
                </div>
              </div>
              <div className="h-56 min-h-[14rem]">
                <ConsultationVolumeChart
                  series={
                    consultationPeriodView === "month"
                      ? consultationVolume.byMonth
                      : consultationVolume.byQuarter
                  }
                  categories={consultationVolume.categories}
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className={`overflow-hidden ${cardSurface}`}
            >
              <div className="flex flex-col gap-1 border-b border-gray-200 px-5 py-4 dark:border-gray-600 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">Recent activity</h2>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Latest events matching your filters.</p>
                </div>
              </div>
              <div className="px-2 pb-2 pt-0 sm:px-4">
                <div className="-mx-2 overflow-x-auto sm:mx-0">
                  <table className="w-full min-w-[640px] border-collapse text-left text-sm text-gray-900 dark:text-gray-100">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/80 dark:border-gray-600 dark:bg-gray-900/20">
                        <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Event
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          User
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Page / module
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Time
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentEvents.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                            {analyticsLoading ? "Loading events…" : "No events match these filters."}
                          </td>
                        </tr>
                      ) : (
                        recentEvents.map((event) => (
                          <tr
                            key={event.id}
                            className="border-b border-gray-200 transition-colors last:border-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
                          >
                            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                              {formatEventType(event.eventType)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <div className="text-sm text-gray-900 dark:text-gray-100">{event.userName || "System"}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{event.userRole || "—"}</div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                              {event.pageName || "—"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                              {formatDate(event.timestamp)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {recentEventsTotalPages > 1 && (
                <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-600 sm:px-6">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Page {recentEventsPage} of {recentEventsTotalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => recentEventsPage > 1 && setRecentEventsPage(recentEventsPage - 1)}
                      disabled={recentEventsPage === 1}
                      className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => recentEventsPage < recentEventsTotalPages && setRecentEventsPage(recentEventsPage + 1)}
                      disabled={recentEventsPage >= recentEventsTotalPages}
                      className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {showAnnouncementModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-[2px]"
            onClick={() => {
              setShowAnnouncementModal(false);
              setAnnouncementData({
                title: "",
                message: "",
                priority: "medium",
                targetAudience: "all",
                selectedCounselorIds: [],
              });
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[min(90vh,720px)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
            >
            <div className="sticky top-0 z-[1] flex flex-col gap-2 border-b border-gray-200 bg-white/95 px-6 py-5 backdrop-blur-sm dark:border-gray-600 dark:bg-gray-800/95">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Broadcast</p>
                  <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">Send announcement</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAnnouncementModal(false);
                    setAnnouncementData({ 
                      title: "", 
                      message: "", 
                      priority: "medium",
                      targetAudience: "all",
                      selectedCounselorIds: []
                    });
                  }}
                  className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {announcementData.targetAudience === "all" 
                  ? "Delivered to every counselor as a notification." 
                  : "Delivered only to the counselors you select."}
              </p>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={announcementData.title}
                  onChange={(e) => setAnnouncementData({ ...announcementData, title: e.target.value })}
                  placeholder="Enter announcement title..."
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={announcementData.message}
                  onChange={(e) => setAnnouncementData({ ...announcementData, message: e.target.value })}
                  placeholder="Enter announcement message..."
                  rows={6}
                  className="w-full resize-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Target Audience <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="targetAudience"
                      value="all"
                      checked={announcementData.targetAudience === "all"}
                      onChange={(e) => setAnnouncementData({ 
                        ...announcementData, 
                        targetAudience: e.target.value,
                        selectedCounselorIds: []
                      })}
                      className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">All counselors</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="targetAudience"
                      value="specific"
                      checked={announcementData.targetAudience === "specific"}
                      onChange={(e) => setAnnouncementData({ 
                        ...announcementData, 
                        targetAudience: e.target.value 
                      })}
                      className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Specific counselors</span>
                  </label>
                </div>
              </div>

              {announcementData.targetAudience === "specific" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Counselors <span className="text-red-500">*</span>
                  </label>
                  {loadingCounselors ? (
                    <div className="text-sm text-gray-500 dark:text-gray-400 py-2">Loading counselors...</div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50/80 dark:border-gray-600 dark:bg-gray-900/30">
                      {counselors.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                          No counselors found
                        </div>
                      ) : (
                        <div className="p-2 space-y-2">
                          {counselors.map((counselor) => (
                            <label
                              key={counselor.id || counselor._id}
                              className="flex cursor-pointer items-center rounded-lg p-2 transition hover:bg-white dark:hover:bg-gray-800"
                            >
                              <input
                                type="checkbox"
                                checked={announcementData.selectedCounselorIds.includes(
                                  counselor.id || counselor._id
                                )}
                                onChange={(e) => {
                                  const counselorId = counselor.id || counselor._id;
                                  if (e.target.checked) {
                                    setAnnouncementData({
                                      ...announcementData,
                                      selectedCounselorIds: [...announcementData.selectedCounselorIds, counselorId],
                                    });
                                  } else {
                                    setAnnouncementData({
                                      ...announcementData,
                                      selectedCounselorIds: announcementData.selectedCounselorIds.filter(
                                        (id) => id !== counselorId
                                      ),
                                    });
                                  }
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <div className="ml-3 flex-1">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {counselor.name || "Unknown"}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {counselor.email}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {announcementData.selectedCounselorIds.length > 0 && (
                    <div className="mt-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      {announcementData.selectedCounselorIds.length} counselor(s) selected
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Priority
                </label>
                <select
                  value={announcementData.priority}
                  onChange={(e) => setAnnouncementData({ ...announcementData, priority: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50/90 p-4 dark:border-gray-600 dark:bg-gray-900/40">
                <div className="flex items-start gap-3">
                  <svg className="mt-0.5 h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                    <p className="mb-1 font-medium text-gray-800 dark:text-gray-200">Note</p>
                    <p>
                      {announcementData.targetAudience === "all"
                        ? "This announcement will be sent as a notification to all counselors in the system. They will see it in their notification center."
                        : "This announcement will be sent as a notification to the selected counselors. They will see it in their notification center."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 bg-gray-50/80 px-6 py-4 dark:border-gray-600 dark:bg-gray-900/30">
              <button
                type="button"
                onClick={() => {
                  setShowAnnouncementModal(false);
                  setAnnouncementData({ 
                    title: "", 
                    message: "", 
                    priority: "medium",
                    targetAudience: "all",
                    selectedCounselorIds: []
                  });
                }}
                disabled={sendingAnnouncement}
                className="h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendAnnouncement}
                disabled={sendingAnnouncement || !announcementData.title.trim() || !announcementData.message.trim()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
              >
                {sendingAnnouncement ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send Announcement
                  </>
                )}
              </button>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Summary Card Component
function SummaryCard({ title, value, accent, onClick }) {
  const accentBar = {
    indigo: "bg-indigo-500 dark:bg-indigo-400",
    emerald: "bg-emerald-500 dark:bg-emerald-400",
    violet: "bg-violet-500 dark:bg-violet-400",
    amber: "bg-amber-500 dark:bg-amber-400",
  };
  const interactive = typeof onClick === "function";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border border-gray-200/90 bg-white p-5 shadow-sm dark:border-gray-700/90 dark:bg-gray-800/80 ${
        interactive
          ? "cursor-pointer transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:hover:border-indigo-500/60"
          : ""
      }`}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-gray-100">{value}</p>
      <div className={`mt-4 h-0.5 w-10 rounded-full ${accentBar[accent] || accentBar.indigo}`} />
    </motion.div>
  );
}

const CONSULT_CHART_COLORS = {
  Individual: "#4f46e5",
  Group: "#10b981",
  "Face to Face": "#f59e0b",
  Online: "#8b5cf6",
  Other: "#94a3b8",
};

function ConsultationVolumeChart({ series, categories }) {
  if (!series || series.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        No consultation data in this range
      </div>
    );
  }

  const chartH = 168;
  const padL = 10;
  const padR = 10;
  const padT = 6;
  const padB = 40;
  const n = series.length;
  const gap = n > 18 ? 4 : 8;
  const innerW = 560;
  const barW = Math.max(6, Math.min(26, (innerW - gap * Math.max(0, n - 1)) / Math.max(n, 1)));
  const chartW = padL + padR + n * barW + Math.max(0, n - 1) * gap;

  const maxTotal = Math.max(...series.map((s) => s.total || 0), 1);
  const plotH = chartH - padT - padB;
  const order =
    Array.isArray(categories) && categories.length > 0
      ? categories
      : ["Individual", "Group", "Face to Face", "Online", "Other"];
  const tilt = n > 12;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <svg
          width={chartW}
          height={chartH}
          viewBox={`0 0 ${chartW} ${chartH}`}
          className="mx-auto block max-w-none"
          role="img"
          aria-label="Consultation volume stacked by session type"
        >
          {series.map((row, i) => {
            const x = padL + i * (barW + gap);
            let yBottom = padT + plotH;
            const rects = [];
            for (const cat of order) {
              const c = row.byCategory?.[cat] || 0;
              if (c <= 0) continue;
              const segH = Math.max((c / maxTotal) * plotH, row.total > 0 ? 1 : 0);
              yBottom -= segH;
              rects.push(
                <rect
                  key={cat}
                  x={x}
                  y={yBottom}
                  width={barW}
                  height={segH}
                  fill={CONSULT_CHART_COLORS[cat] || "#94a3b8"}
                  rx={1}
                />
              );
            }
            const cx = x + barW / 2;
            return (
              <g key={row.periodKey || String(i)}>
                {rects}
                <text
                  x={cx}
                  y={chartH - (tilt ? 4 : 10)}
                  textAnchor="middle"
                  className="fill-gray-600 dark:fill-gray-400"
                  fontSize={tilt ? 8 : 9}
                  transform={tilt ? `rotate(-38 ${cx} ${chartH - 10})` : undefined}
                >
                  {row.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 border-t border-gray-100 pt-2 dark:border-gray-700/80">
        {order.map((cat) => (
          <div key={cat} className="flex items-center gap-1.5 text-[10px] text-gray-600 dark:text-gray-400">
            <span
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: CONSULT_CHART_COLORS[cat] || "#94a3b8" }}
            />
            <span>{cat}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Chart Card Component
function ChartCard({ title, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-sm dark:border-gray-700/90 dark:bg-gray-800/80 sm:p-6"
    >
      <h3 className="mb-4 text-sm font-semibold tracking-tight text-gray-900 dark:text-gray-100">{title}</h3>
      <div className="h-52 min-h-[12rem]">{children}</div>
    </motion.div>
  );
}

// Line Chart Component
function LineChart({ data, period = "daily" }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.count || 0), 1);
  const chartHeight = 200;
  const chartWidth = 600;
  const padding = 20;
  const labelHeight = 25; // Space for day labels
  const totalHeight = chartHeight + labelHeight;
  const dataLength = data.length;
  const divisor = dataLength > 1 ? dataLength - 1 : 1;
  
  const getXAxisLabel = (item) => {
    if (item?.label) return item.label;
    if (item?.date) {
      try {
        const date = new Date(item.date);
        return String(date.getDate());
      } catch {
        return item.date;
      }
    }
    return "";
  };

  const formatXAxisLabel = (item) => {
    const raw = getXAxisLabel(item);
    if (period === "monthly") {
      return raw.replace(" ", "\n");
    }
    return raw;
  };
  
  const points = data.map((d, i) => {
    const count = d.count || 0;
    const x = ((i / divisor) * (chartWidth - padding * 2) + padding).toFixed(2);
    const y = (chartHeight - (count / maxValue) * (chartHeight - padding * 2) - padding).toFixed(2);
    return `${x},${y}`;
  });

  return (
    <div className="h-full flex items-center justify-center">
      <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${totalHeight}`} className="overflow-visible">
        <polyline
          fill="none"
          stroke="#4f46e5"
          strokeWidth="2"
          points={points.join(" ")}
          className="drop-shadow-sm"
        />
        {data.map((d, i) => {
          const count = d.count || 0;
          const x = ((i / divisor) * (chartWidth - padding * 2) + padding).toFixed(2);
          const y = (chartHeight - (count / maxValue) * (chartHeight - padding * 2) - padding).toFixed(2);
          const xLabel = formatXAxisLabel(d);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="4" fill="#4f46e5" className="drop-shadow-sm" />
              <text
                x={x}
                y={Number(y) - 8}
                textAnchor="middle"
                className="fill-indigo-300 dark:fill-indigo-200"
                fontSize="10"
                fontWeight="600"
              >
                {count}
              </text>
              {/* Day label below the chart */}
              <text
                x={x}
                y={chartHeight + 15}
                textAnchor="middle"
                className="text-xs fill-gray-600 dark:fill-gray-400"
                fontSize="10"
                style={{ whiteSpace: "pre-line" }}
              >
                {xLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function DistributionPieChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        No data available
      </div>
    );
  }

  const colors = [
    "#6366f1",
    "#22c55e",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#84cc16",
    "#f97316",
    "#e11d48",
    "#a855f7",
  ];
  const total = data.reduce((sum, item) => sum + (item.count || 0), 0) || 1;
  let cumulative = 0;
  const normalized = data.slice(0, 10).map((item) => {
    const value = item.count || 0;
    const start = (cumulative / total) * 100;
    cumulative += value;
    const end = (cumulative / total) * 100;
    return { ...item, start, end };
  });
  const gradientStops = normalized
    .flatMap((item, idx) => {
      const color = colors[idx % colors.length];
      return [
        <stop key={`${item.label}-s`} offset={`${item.start}%`} stopColor={color} />,
        <stop key={`${item.label}-e`} offset={`${item.end}%`} stopColor={color} />,
      ];
    });

  return (
    <div className="h-full flex flex-col items-center justify-center gap-4">
      <svg width="128" height="128" viewBox="0 0 42 42" className="shrink-0">
        <defs>
          <linearGradient id="distribution-pie-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            {gradientStops}
          </linearGradient>
        </defs>
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#334155" strokeWidth="6" />
        <circle
          cx="21"
          cy="21"
          r="15.915"
          fill="transparent"
          stroke="url(#distribution-pie-gradient)"
          strokeWidth="6"
          strokeDasharray="100 100"
          transform="rotate(-90 21 21)"
        />
      </svg>
      <div className="grid w-full grid-cols-1 gap-1.5">
        {normalized.map((item, idx) => {
          const pct = ((item.count || 0) / total) * 100;
          return (
            <div key={item.label} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: colors[idx % colors.length] }}
                />
                <span className="truncate text-gray-700 dark:text-gray-300">{item.label}</span>
              </div>
              <div className="shrink-0 font-medium text-gray-900 dark:text-gray-100">
                {item.count} ({pct.toFixed(1)}%)
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Bar Chart Component
function BarChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex items-end gap-3 h-40">
        {data.map((item, i) => {
          const height = (item.count / maxValue) * 150;
          return (
            <div key={i} className="flex flex-col items-center">
              <div
                className="bg-indigo-500 rounded-t w-10 transition-all"
                style={{ height: `${height}px`, minHeight: item.count > 0 ? "4px" : "0" }}
              ></div>
              <div className="text-[10px] text-gray-600 dark:text-gray-400 mt-1.5 text-center max-w-14 truncate">
                {item.pageName}
              </div>
              <div className="text-[10px] font-medium text-gray-900 dark:text-gray-100 mt-0.5">{item.count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Pie Chart Component
function PieChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        No data available
      </div>
    );
  }

  const colors = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div className="h-full flex items-center justify-center">
      <div className="grid grid-cols-2 gap-3">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded flex-shrink-0"
              style={{ backgroundColor: colors[i % colors.length] }}
            ></div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{item.status}</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                {item.count} ({item.percentage}%)
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper functions
function formatEventType(eventType) {
  return eventType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
