import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import { motion } from "framer-motion";
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
  const [adminProfile, setAdminProfile] = useState(null);
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
  const [recentEvents, setRecentEvents] = useState([]);
  const [recentEventsPage, setRecentEventsPage] = useState(1);
  const [recentEventsTotalPages, setRecentEventsTotalPages] = useState(1);
  const [dateRange, setDateRange] = useState("30d");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [pageNameFilter, setPageNameFilter] = useState("");
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

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

        // Fetch admin profile for profile picture
        fetchAdminProfile(token);

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

  // Fetch admin profile
  const fetchAdminProfile = async (token) => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.get(`${baseUrl}/api/admin/profile`, {
        headers: token ? { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        } : {
          "Content-Type": "application/json"
        },
      });
      
      if (res.data.success && res.data.profile) {
        setAdminProfile(res.data.profile);
        console.log("✅ Admin profile fetched:", res.data.profile);
      } else {
        console.warn("⚠️ Admin profile response format unexpected:", res.data);
      }
    } catch (err) {
      console.warn("Could not fetch admin profile:", err.message || err);
      // If profile endpoint fails, continue without profile picture
    }
  };

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

      // Fetch daily records
      const dailyRes = await axios.get(`${BASE_URL}/api/admin/analytics/daily-records`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { range: dateRange },
      });
      if (dailyRes.data.success) {
        setDailyRecords(dailyRes.data.dailyRecords);
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
  }, [dateRange, eventTypeFilter, pageNameFilter, recentEventsPage]);

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


  if (accessDenied) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          fontFamily: "'Montserrat', sans-serif",
          flexDirection: "column",
          gap: 12,
          background: "linear-gradient(135deg, #eef2ff, #c7d2fe)",
        }}
      >
        <h2 style={{ color: "#dc2626" }}>Access Denied</h2>
        <p style={{ color: "#6b7280" }}>You do not have permission to access the Admin Dashboard. Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 font-sans p-4 md:p-8 gap-6">
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        {/* Left: Overview / Navigation */}
        <AdminSidebar />

        {/* Right: Main content */}
        <main>
          {/* Welcome Header */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm mb-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-gray-900 dark:text-gray-100 m-0 text-2xl font-bold">
                  Welcome{admin?.name ? `, ${admin.name}` : ""} 🎉
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                  Manage users, monitor system activity, and access administrative tools.
                </p>
              </div>
              
              {/* Profile Picture, Name, and Role */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-semibold text-gray-900 dark:text-gray-100 text-base">
                    {adminProfile?.name || admin?.name || "Admin"}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 capitalize">
                    {adminProfile?.role || admin?.role || "Administrator"}
                  </div>
                </div>
                {adminProfile?.profilePicture || admin?.profilePicture ? (
                  <img
                    src={adminProfile?.profilePicture || getImageUrl(admin?.profilePicture)}
                    alt="Admin Profile"
                    className="w-12 h-12 rounded-full object-cover border-2 border-indigo-200 dark:border-indigo-700"
                    onError={(e) => {
                      // Hide broken image and show placeholder
                      e.target.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900 border-2 border-indigo-200 dark:border-indigo-700 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-6 h-6 text-indigo-600 dark:text-indigo-400"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Analytics Dashboard */}
          <section className="space-y-6">
            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm">
              <div className="flex gap-3 items-center flex-wrap">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Date Range:</label>
                <select
                  value={dateRange}
                  onChange={(e) => {
                    setDateRange(e.target.value);
                    setRecentEventsPage(1); // Reset to first page when filter changes
                  }}
                  className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                  <option value="1y">Last Year</option>
                </select>

                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 ml-4">
                  Event Type:
                </label>
                <select
                  value={eventTypeFilter}
                  onChange={(e) => {
                    setEventTypeFilter(e.target.value);
                    setRecentEventsPage(1); // Reset to first page when filter changes
                  }}
                  className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Events</option>
                  <option value="record_created">Records Created</option>
                  <option value="record_updated">Records Updated</option>
                  <option value="pdf_generated">PDFs Generated</option>
                  <option value="drive_uploaded">Drive Uploads</option>
                  <option value="page_visit">Page Visits</option>
                  <option value="user_login">User Logins</option>
                </select>

                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 ml-4">
                  Page:
                </label>
                <select
                  value={pageNameFilter}
                  onChange={(e) => {
                    setPageNameFilter(e.target.value);
                    setRecentEventsPage(1); // Reset to first page when filter changes
                  }}
                  className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Pages</option>
                  <option value="Dashboard">Dashboard</option>
                  <option value="Records Page">Records Page</option>
                  <option value="Reports Page">Reports Page</option>
                  <option value="Notification Center">Notification Center</option>
                  <option value="Settings">Settings</option>
                </select>
              </div>
            </div>

            {/* Announcement Card */}
            <div className="mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-lg p-4 border border-blue-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500 dark:bg-blue-600 p-2 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Send Announcement</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Notify all counselors with important updates</p>
                  </div>
                </div>
                <button
                  onClick={handleOpenAnnouncementModal}
                  className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Announcement
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard
                title="Total Records"
                value={analyticsOverview.totalRecords.toLocaleString()}
                icon="📋"
                color="blue"
              />
              <SummaryCard
                title="PDFs Generated"
                value={analyticsOverview.totalPDFsGenerated.toLocaleString()}
                icon="📄"
                color="green"
              />
              <SummaryCard
                title="Drive Uploads"
                value={analyticsOverview.totalDriveUploads.toLocaleString()}
                icon="☁️"
                color="purple"
              />
              <SummaryCard
                title="Active Counselors"
                value={analyticsOverview.activeCounselorsThisWeek.toLocaleString()}
                icon="👥"
                color="orange"
              />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Daily Records Chart */}
              <ChartCard title="Daily Records Created">
                <LineChart data={dailyRecords} />
              </ChartCard>

              {/* Record Status Distribution */}
              <ChartCard title="Record Status Distribution">
                <PieChart data={recordStatusDistribution} />
              </ChartCard>
            </div>

            {/* Recent Activities Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Recent Activities</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-[10px] font-medium text-gray-700 dark:text-gray-300 uppercase">
                        Event
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] font-medium text-gray-700 dark:text-gray-300 uppercase">
                        User
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] font-medium text-gray-700 dark:text-gray-300 uppercase">
                        Page/Module
                      </th>
                      <th className="px-4 py-2 text-left text-[10px] font-medium text-gray-700 dark:text-gray-300 uppercase">
                        Timestamp
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {recentEvents.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-4 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
                          {analyticsLoading ? "Loading..." : "No recent activities found"}
                        </td>
                      </tr>
                    ) : (
                      recentEvents.map((event) => (
                        <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-2 whitespace-nowrap">
                            <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                              {formatEventType(event.eventType)}
                            </span>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <div className="text-xs text-gray-900 dark:text-gray-100">
                              {event.userName || "System"}
                            </div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400">
                              {event.userRole || "N/A"}
                            </div>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                            {event.pageName || "N/A"}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(event.timestamp)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination Controls */}
              {recentEventsTotalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Page {recentEventsPage} of {recentEventsTotalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (recentEventsPage > 1) {
                          setRecentEventsPage(recentEventsPage - 1);
                        }
                      }}
                      disabled={recentEventsPage === 1}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => {
                        if (recentEventsPage < recentEventsTotalPages) {
                          setRecentEventsPage(recentEventsPage + 1);
                        }
                      }}
                      disabled={recentEventsPage >= recentEventsTotalPages}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

      {/* Announcement Modal */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Send Announcement</h2>
                <button
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
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {announcementData.targetAudience === "all" 
                  ? "Send an important message to all counselors" 
                  : "Send an important message to selected counselors"}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={announcementData.title}
                  onChange={(e) => setAnnouncementData({ ...announcementData, title: e.target.value })}
                  placeholder="Enter announcement title..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">All Counselors</span>
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
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Specific Counselors</span>
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
                    <div className="border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 max-h-48 overflow-y-auto">
                      {counselors.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                          No counselors found
                        </div>
                      ) : (
                        <div className="p-2 space-y-2">
                          {counselors.map((counselor) => (
                            <label
                              key={counselor.id || counselor._id}
                              className="flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded cursor-pointer"
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
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
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
                    <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
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
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-medium mb-1">Note:</p>
                    <p>
                      {announcementData.targetAudience === "all"
                        ? "This announcement will be sent as a notification to all counselors in the system. They will see it in their notification center."
                        : "This announcement will be sent as a notification to the selected counselors. They will see it in their notification center."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
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
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendAnnouncement}
                disabled={sendingAnnouncement || !announcementData.title.trim() || !announcementData.message.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
        </div>
      )}
    </div>
  );
}

// Summary Card Component
function SummaryCard({ title, value, icon, color }) {
  const colorClasses = {
    blue: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
    green: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
    purple: "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200",
    orange: "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">{title}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ml-2 flex-shrink-0 ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
}

// Chart Card Component
function ChartCard({ title, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm"
    >
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">{title}</h3>
      <div className="h-48">{children}</div>
    </motion.div>
  );
}

// Line Chart Component
function LineChart({ data }) {
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
  
  // Helper function to get day from date string
  const getDayFromDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.getDate(); // Returns day of month (1-31)
    } catch (e) {
      return "";
    }
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
          const day = getDayFromDate(d.date);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="4" fill="#4f46e5" className="drop-shadow-sm" />
              {/* Day label below the chart */}
              <text
                x={x}
                y={chartHeight + 15}
                textAnchor="middle"
                className="text-xs fill-gray-600 dark:fill-gray-400"
                fontSize="10"
              >
                {day}
              </text>
            </g>
          );
        })}
      </svg>
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
