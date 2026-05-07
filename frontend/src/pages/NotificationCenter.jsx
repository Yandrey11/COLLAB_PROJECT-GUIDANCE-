import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import Swal from "sweetalert2";
import { NotificationBadgeBadge } from "../components/NotificationBadge";
import CounselorSidebar from "../components/CounselorSidebar";
import CounselorHeaderProfile from "../components/CounselorHeaderProfile.jsx";
import { initializeTheme } from "../utils/themeUtils";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { API_BASE_URL } from "../config/apiBaseUrl";

const BASE_URL = API_BASE_URL;

const pageStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const pageItem = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
  },
};

// Helper function to get full image URL from backend
const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  if (imagePath.startsWith("data:")) {
    return imagePath;
  }
  const path = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  return `${BASE_URL}${path}`;
};

export default function NotificationCenter() {
  useDocumentTitle("Notifications");
  const navigate = useNavigate();
  const baseUrl = API_BASE_URL;
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme();
  }, []);

  // Load user from localStorage and fetch profile
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error("Error parsing user data:", err);
      }
    }
  }, []);

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token || !user) return;

        const res = await axios.get(`${baseUrl}/api/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.data.success) {
          setProfile(res.data.profile);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };

    if (user) {
      fetchProfile();
    }
  }, [user, baseUrl]);

  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
    if (!token) {
      console.warn("🚫 No token found, redirecting to login...");
      navigate("/login", { replace: true });
      return;
    }

    // Load notifications
    const loadNotifications = async () => {
      try {
        setLoading(true);
        await fetchNotifications(token, 1, "all", "all", "");
      } catch (err) {
        console.error("❌ Error loading notifications:", err);
        // If it's an auth error, redirect to login
        if (err.response?.status === 401 || err.response?.status === 403) {
          localStorage.removeItem("token");
          localStorage.removeItem("authToken");
          navigate("/login", { replace: true });
          return;
        }
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();

    // Set up polling for real-time updates (every 10 seconds)
    const interval = setInterval(() => {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      if (token) {
        fetchNotifications(token, currentPage, statusFilter, categoryFilter, searchQuery);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [navigate]);

  const fetchNotifications = async (token, page = 1, status = "all", category = "all", search = "") => {
    try {
      const params = {
        page,
        limit: 5, // Show only 5 notifications per page
        status,
        category,
        search: search.trim(),
      };

      const res = await axios.get(`${baseUrl}/api/counselor/notifications`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        params,
      });

      setNotifications(res.data.notifications || []);
      setTotalPages(res.data.totalPages || 1);
      setCurrentPage(res.data.currentPage || 1);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      console.error("❌ Error fetching notifications:", err);
      console.error("Error response:", err.response?.data);
      console.error("Error status:", err.response?.status);
      
      let errorMessage = "Failed to load notifications";
      
      if (err.response?.status === 401) {
        errorMessage = "Authentication failed. Please log in again.";
        localStorage.removeItem("token");
        localStorage.removeItem("authToken");
        setTimeout(() => navigate("/login"), 2000);
      } else if (err.response?.status === 403) {
        errorMessage = "Access denied. You don't have permission to view notifications.";
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setMessage({
        type: "error",
        text: errorMessage,
      });
      setTimeout(() => setMessage({ type: "", text: "" }), 5000);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
    if (!token) return;
    setCurrentPage(1);
    setLoading(true);
    try {
      await fetchNotifications(token, 1, statusFilter, categoryFilter, searchQuery);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = async () => {
    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
    setCurrentPage(1);
    await fetchNotifications(token, 1, statusFilter, categoryFilter, searchQuery);
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      await axios.put(
        `${baseUrl}/api/counselor/notifications/${notificationId}/read`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      await fetchNotifications(token, currentPage, statusFilter, categoryFilter, searchQuery);
    } catch (err) {
      console.error("❌ Error marking as read:", err);
      setMessage({ type: "error", text: "Failed to update notification" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    }
  };

  const handleMarkAsUnread = async (notificationId) => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      await axios.put(
        `${baseUrl}/api/counselor/notifications/${notificationId}/unread`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      await fetchNotifications(token, currentPage, statusFilter, categoryFilter, searchQuery);
    } catch (err) {
      console.error("❌ Error marking as unread:", err);
      setMessage({ type: "error", text: "Failed to update notification" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    }
  };

  const handleMarkAllAsRead = async () => {
    const result = await Swal.fire({
      title: "Mark All as Read?",
      text: "Mark all notifications as read?",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#4f46e5",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, mark all",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      await axios.put(
        `${baseUrl}/api/counselor/notifications/read-all`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setMessage({ type: "success", text: "All notifications marked as read" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);

      await fetchNotifications(token, currentPage, statusFilter, categoryFilter, searchQuery);
    } catch (err) {
      console.error("❌ Error marking all as read:", err);
      setMessage({ type: "error", text: "Failed to update notifications" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    }
  };

  const handleDelete = async (notificationId) => {
    const result = await Swal.fire({
      title: "Delete Notification?",
      text: "Are you sure you want to delete this notification?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      await axios.delete(`${baseUrl}/api/counselor/notifications/${notificationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMessage({ type: "success", text: "Notification deleted successfully" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);

      await fetchNotifications(token, currentPage, statusFilter, categoryFilter, searchQuery);
    } catch (err) {
      console.error("❌ Error deleting notification:", err);
      setMessage({ type: "error", text: "Failed to delete notification" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    }
  };

  const handleDeleteAllRead = async () => {
    const result = await Swal.fire({
      title: "Delete All Read?",
      text: "Are you sure you want to delete all read notifications?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete all",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      await axios.delete(`${baseUrl}/api/counselor/notifications/read/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMessage({ type: "success", text: "All read notifications deleted" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);

      await fetchNotifications(token, currentPage, statusFilter, categoryFilter, searchQuery);
    } catch (err) {
      console.error("❌ Error deleting read notifications:", err);
      setMessage({ type: "error", text: "Failed to delete notifications" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      "New Record": { bg: "bg-blue-100 text-blue-700", icon: "📝" },
      "Assigned Record": { bg: "bg-purple-100 text-purple-700", icon: "👤" },
      "Updated Record": { bg: "bg-green-100 text-green-700", icon: "✏️" },
      "Schedule Reminder": { bg: "bg-yellow-100 text-yellow-700", icon: "⏰" },
      Announcement: { bg: "bg-indigo-100 text-indigo-700", icon: "📢" },
      "System Alert": { bg: "bg-gray-100 text-gray-700", icon: "🔔" },
      "Record Request": { bg: "bg-orange-100 text-orange-700", icon: "📋" },
    };
    return colors[category] || colors["System Alert"];
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      critical: { bg: "bg-red-100 text-red-700", text: "Critical" },
      high: { bg: "bg-orange-100 text-orange-700", text: "High" },
      medium: { bg: "bg-yellow-100 text-yellow-700", text: "Medium" },
      low: { bg: "bg-gray-100 text-gray-700", text: "Low" },
    };
    return badges[priority] || badges.medium;
  };

  const formatTime = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleRefresh = () => {
    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
    if (token) {
      fetchNotifications(token, currentPage, statusFilter, categoryFilter, searchQuery);
    }
  };

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
      const token = localStorage.getItem("authToken") || localStorage.getItem("token");

      try {
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
  };

  return (
    <div className="min-h-screen w-full page-bg counselor-typography font-sans text-gray-900 dark:text-gray-100">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <motion.main
          className="flex min-w-0 flex-col gap-8"
          variants={pageStagger}
          initial="hidden"
          animate="show"
        >
          <motion.header
            variants={pageItem}
            className="flex flex-col gap-5 border-b border-gray-200/80 pb-8 dark:border-gray-700/80 sm:flex-row sm:items-center sm:justify-between sm:gap-8 lg:pb-10"
          >
            <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-5">
              <CounselorSidebar variant="header" />
              <div className="hidden h-10 w-px shrink-0 bg-gray-200 dark:bg-gray-700 sm:block" aria-hidden />
              <div className="min-w-0">
                <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                  Inbox
                </p>
                <h1 className="mt-1.5 m-0 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 sm:text-3xl">
                  Notifications
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  Records, assignments, and announcements in one place.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4">
              {unreadCount > 0 && (
                <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                  {unreadCount} unread
                </span>
              )}
              <CounselorHeaderProfile />
            </div>
          </motion.header>

          {message.text && (
            <motion.div
              variants={pageItem}
              className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                message.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                  : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
              }`}
            >
              {message.text}
            </motion.div>
          )}

          <motion.section
            variants={pageItem}
            className="rounded-2xl border border-gray-200/90 bg-white dark:border-gray-700/90 dark:bg-gray-800/80"
          >
            <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-700/80 sm:px-6 sm:py-5">
              <h2 className="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">Search & filters</h2>
              <p className="mt-1 m-0 text-sm text-gray-500 dark:text-gray-400">
                Narrow by status, category, or keywords
              </p>
            </div>
            <form onSubmit={handleSearch} className="flex flex-col gap-3 p-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:p-6">
              <input
                type="text"
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-h-[2.75rem] w-full flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-600 dark:bg-gray-900/30 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:ring-white/10 sm:min-w-[220px]"
              />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  handleFilter();
                }}
                className="min-h-[2.75rem] w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-600 dark:bg-gray-900/30 dark:text-gray-100 dark:focus:ring-white/10 sm:w-auto sm:min-w-[10rem]"
              >
                <option value="all">All statuses</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  handleFilter();
                }}
                className="min-h-[2.75rem] w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-600 dark:bg-gray-900/30 dark:text-gray-100 dark:focus:ring-white/10 sm:w-auto sm:min-w-[11rem]"
              >
                <option value="all">All categories</option>
                <option value="New Record">New Record</option>
                <option value="Assigned Record">Assigned Record</option>
                <option value="Updated Record">Updated Record</option>
                <option value="Schedule Reminder">Schedule Reminder</option>
                <option value="Announcement">Announcement</option>
                <option value="System Alert">System Alert</option>
              </select>
              <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row">
                <button
                  type="submit"
                  className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                >
                  Search
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("all");
                    setCategoryFilter("all");
                    setSearchQuery("");
                    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
                    fetchNotifications(token, 1, "all", "all", "");
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/80"
                >
                  Reset
                </button>
              </div>
            </form>
          </motion.section>

          <motion.div variants={pageItem} className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
            >
              Mark all read
            </button>
            <button
              type="button"
              onClick={handleDeleteAllRead}
              className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-950/30"
            >
              Delete read
            </button>
          </motion.div>

          <motion.section
            variants={pageItem}
            className="rounded-2xl border border-gray-200/90 bg-white dark:border-gray-700/90 dark:bg-gray-800/80"
          >
            <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-700/80 sm:px-6 sm:py-5">
              <h2 className="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">Feed</h2>
              <p className="mt-1 m-0 text-sm text-gray-500 dark:text-gray-400">
                Latest items first
              </p>
            </div>
            <div className="p-4 sm:p-6">
          {notifications.length === 0 ? (
            <div className="py-16 text-center text-gray-500 dark:text-gray-400">
              <p className="m-0 text-sm font-medium text-gray-600 dark:text-gray-300">No notifications match your filters.</p>
              <p className="mt-2 m-0 text-sm text-gray-500 dark:text-gray-400">You&apos;re all caught up.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {notifications.map((notification) => {
                  const isUnread = notification.status === "unread";
                  const categoryColors = getCategoryColor(notification.category);
                  const priorityBadge = getPriorityBadge(notification.priority);
                  const isCritical = notification.priority === "critical";

                  return (
                    <div
                      key={notification.id}
                      className={`rounded-xl border p-3 transition-colors sm:p-4 ${
                        isUnread
                          ? "border-indigo-200/90 bg-indigo-50/80 dark:border-indigo-800/60 dark:bg-indigo-950/25"
                          : "border-gray-100 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-900/20"
                      } ${isCritical ? "ring-1 ring-red-200/80 dark:ring-red-900/40" : ""} hover:border-gray-200 dark:hover:border-gray-600`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className="text-sm">{categoryColors.icon}</span>
                            <h3
                              className={`m-0 font-semibold text-xs truncate ${
                                isUnread ? "text-gray-900 dark:text-gray-100" : "text-gray-700 dark:text-gray-300"
                              }`}
                            >
                              {notification.title}
                            </h3>
                            {isUnread && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-semibold whitespace-nowrap">
                                NEW
                              </span>
                            )}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${categoryColors.bg}`}>
                              {notification.category}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${priorityBadge.bg}`}>
                              {priorityBadge.text}
                            </span>
                          </div>
                          <p className="text-gray-600 dark:text-gray-400 text-xs mb-2 leading-snug line-clamp-2">
                            {notification.description}
                          </p>
                          <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400 flex-wrap">
                            <span>{formatTime(notification.createdAt)}</span>
                            <div className="flex gap-1.5">
                              {isUnread ? (
                                <button
                                  onClick={() => handleMarkAsRead(notification.id)}
                                  className="px-2 py-0.5 rounded border border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-50 transition-colors font-semibold text-[10px] whitespace-nowrap"
                                >
                                  Mark as Read
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleMarkAsUnread(notification.id)}
                                  className="px-2 py-0.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors font-semibold text-[10px] whitespace-nowrap"
                                >
                                  Mark as Unread
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(notification.id)}
                                className="px-2 py-0.5 rounded border border-red-200 bg-white text-red-600 hover:bg-red-50 transition-colors font-semibold text-[10px] whitespace-nowrap"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex flex-col gap-3 border-t border-gray-100 pt-6 dark:border-gray-700/80 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const token = localStorage.getItem("token") || localStorage.getItem("authToken");
                        if (currentPage > 1) {
                          fetchNotifications(token, currentPage - 1, statusFilter, categoryFilter, searchQuery);
                        }
                      }}
                      disabled={currentPage <= 1}
                      className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                        currentPage <= 1
                          ? "cursor-not-allowed border-gray-100 text-gray-400 dark:border-gray-800"
                          : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
                      }`}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const token = localStorage.getItem("token") || localStorage.getItem("authToken");
                        if (currentPage < totalPages) {
                          fetchNotifications(token, currentPage + 1, statusFilter, categoryFilter, searchQuery);
                        }
                      }}
                      disabled={currentPage >= totalPages}
                      className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                        currentPage >= totalPages
                          ? "cursor-not-allowed border-gray-100 text-gray-400 dark:border-gray-800"
                          : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
                      }`}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
            </div>
          </motion.section>
        </motion.main>
      </div>
    </div>
  );
}

