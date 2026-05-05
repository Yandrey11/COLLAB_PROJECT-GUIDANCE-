import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import AdminSidebar from "../../components/AdminSidebar";
import { initializeTheme } from "../../utils/themeUtils";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

export default function NotificationCenter() {
  useDocumentTitle("Admin Notifications");
  const navigate = useNavigate();
  const SETTINGS_API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/admin/settings`;
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    newUserCreations: true,
    recordUpdates: true,
    criticalSystemAlerts: true,
    pdfGenerations: true,
    loginAttempts: false,
    soundEnabled: false,
  });

  useEffect(() => {
    initializeTheme();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      navigate("/adminlogin", { replace: true });
      return;
    }

    // Verify admin access
    const verifyAdmin = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
        const res = await axios.get(`${baseUrl}/api/admin/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data.role !== "admin") {
          navigate("/adminlogin", { replace: true });
          return;
        }

        // Load notifications
        await Promise.all([
          fetchNotifications(token, 1, "all", "all", ""),
          fetchNotificationSettings(token),
        ]);
        setLoading(false);
      } catch (err) {
        console.error("❌ Admin verification failed:", err);
        navigate("/adminlogin", { replace: true });
      }
    };

    verifyAdmin();

    // Set up polling for real-time updates (every 10 seconds)
    const interval = setInterval(() => {
      const token = localStorage.getItem("adminToken");
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
        limit: 5, 
        status, 
        category, 
        search: search.trim() // Trim whitespace from search
      };
      
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.get(`${baseUrl}/api/admin/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      setNotifications(res.data.notifications || []);
      setTotalPages(res.data.totalPages || 1);
      setCurrentPage(res.data.currentPage || 1);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (err) {
      console.error("❌ Error fetching notifications:", err);
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to load notifications" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    }
  };

  const fetchNotificationSettings = async (token) => {
    try {
      const res = await axios.get(SETTINGS_API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.success && res.data.settings?.notifications) {
        setNotificationSettings((prev) => ({
          ...prev,
          ...res.data.settings.notifications,
        }));
      }
    } catch (err) {
      console.error("❌ Error fetching notification settings:", err);
    }
  };

  const handleSaveNotificationSettings = async () => {
    try {
      setSavingSettings(true);
      const token = localStorage.getItem("adminToken");
      const res = await axios.put(
        `${SETTINGS_API_URL}/notifications`,
        notificationSettings,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.data.success) {
        await Swal.fire({
          icon: "success",
          title: "Settings Saved!",
          text: "Notification settings have been updated successfully.",
          timer: 2000,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      console.error("❌ Error saving notification settings:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.response?.data?.message || "Failed to save notification settings",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("adminToken");
    if (!token) return;
    setCurrentPage(1); // Reset to first page when searching
    setLoading(true);
    try {
      await fetchNotifications(token, 1, statusFilter, categoryFilter, searchQuery);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem("adminToken");
      await axios.put(
        `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/admin/notifications/${notificationId}/read`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Refresh notifications
      await fetchNotifications(token, currentPage, statusFilter, categoryFilter, searchQuery);
    } catch (err) {
      console.error("❌ Error marking as read:", err);
      setMessage({ type: "error", text: "Failed to update notification" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    }
  };

  const handleMarkAsUnread = async (notificationId) => {
    try {
      const token = localStorage.getItem("adminToken");
      await axios.put(
        `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/admin/notifications/${notificationId}/unread`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Refresh notifications
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
      const token = localStorage.getItem("adminToken");
      await axios.put(
        `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/admin/notifications/read-all`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setMessage({ type: "success", text: "All notifications marked as read" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);

      // Refresh notifications
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
      const token = localStorage.getItem("adminToken");
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      await axios.delete(`${baseUrl}/api/admin/notifications/${notificationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMessage({ type: "success", text: "Notification deleted successfully" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);

      // Refresh notifications
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
      const token = localStorage.getItem("adminToken");
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      await axios.delete(`${baseUrl}/api/admin/notifications/read/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMessage({ type: "success", text: "All read notifications deleted" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);

      // Refresh notifications
      await fetchNotifications(token, currentPage, statusFilter, categoryFilter, searchQuery);
    } catch (err) {
      console.error("❌ Error deleting read notifications:", err);
      setMessage({ type: "error", text: "Failed to delete notifications" });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case "System Alert":
        return {
          icon: "⚠️",
          chip: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/70 dark:bg-blue-950/40 dark:text-blue-300",
        };
      case "User Activity":
        return {
          icon: "👤",
          chip: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-300",
        };
      case "Error":
        return {
          icon: "❌",
          chip: "border-red-200 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/40 dark:text-red-300",
        };
      case "Security Alert":
        return {
          icon: "🔒",
          chip: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-300",
        };
      default:
        return {
          icon: "ℹ️",
          chip: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300",
        };
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case "critical":
        return {
          text: "Critical",
          chip: "border-red-200 bg-red-50 text-red-700 dark:border-red-800/70 dark:bg-red-950/40 dark:text-red-300",
        };
      case "high":
        return {
          text: "High",
          chip: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-300",
        };
      case "medium":
        return {
          text: "Medium",
          chip: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/70 dark:bg-blue-950/40 dark:text-blue-300",
        };
      default:
        return {
          text: "Low",
          chip: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300",
        };
    }
  };

  return (
    <div className="page-bg admin-typography min-h-screen w-full px-3 py-3 font-sans text-gray-900 dark:text-gray-100 sm:px-4 md:px-5 md:py-5">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-5">
        <section className="rounded-2xl border border-gray-200 bg-white/95 p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/95 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <AdminSidebar variant="header" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                  Admin Center
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                  Notification Center
                </h1>
                <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
                  Monitor alerts, review activity, and manage notification flow.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleMarkAllAsRead}
                className="h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-indigo-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-indigo-300 dark:hover:bg-gray-600"
              >
                Mark All Read
              </button>
              <button
                onClick={handleDeleteAllRead}
                className="h-10 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-800/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/40"
              >
                Delete Read
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <article className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Total on page
              </p>
              <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
                {notifications.length}
              </p>
            </article>
            <article className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/30">
              <p className="text-xs uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                Unread
              </p>
              <p className="mt-1 text-xl font-semibold text-indigo-700 dark:text-indigo-200">
                {unreadCount}
              </p>
            </article>
            <article className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Current page
              </p>
              <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
                {currentPage} / {totalPages}
              </p>
            </article>
          </div>
        </section>

        {message.text && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-medium ${
              message.type === "success"
                ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-300"
                : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
          <button
            type="button"
            onClick={() => setShowNotificationSettings((prev) => !prev)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Notification Settings
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Choose what activity should notify administrators.
              </p>
            </div>
            <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
              {showNotificationSettings ? "Hide" : "Show"}
            </span>
          </button>

          {showNotificationSettings && (
            <div className="mt-5 space-y-4">
              {[
                {
                  key: "newUserCreations",
                  label: "New User Creations",
                  description: "Receive notifications when new users are created.",
                },
                {
                  key: "recordUpdates",
                  label: "Record Updates",
                  description: "Receive notifications when counseling records are updated.",
                },
                {
                  key: "criticalSystemAlerts",
                  label: "Critical System Alerts",
                  description: "Receive notifications for critical system events.",
                },
                {
                  key: "pdfGenerations",
                  label: "PDF Generations",
                  description: "Receive notifications when PDFs are generated.",
                },
                {
                  key: "loginAttempts",
                  label: "Login Attempts",
                  description: "Receive notifications for admin login attempts.",
                },
                {
                  key: "soundEnabled",
                  label: "Notification Sound",
                  description: "Play sound whenever a new notification arrives.",
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {item.description}
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={notificationSettings[item.key]}
                      onChange={(e) =>
                        setNotificationSettings((prev) => ({
                          ...prev,
                          [item.key]: e.target.checked,
                        }))
                      }
                      className="peer sr-only"
                    />
                    <div className="relative h-6 w-11 shrink-0 rounded-full bg-gray-200 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300/80 peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-gray-600 dark:peer-focus:ring-indigo-800/60" />
                  </label>
                </div>
              ))}
              <button
                onClick={handleSaveNotificationSettings}
                disabled={savingSettings}
                className="mt-1 h-10 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingSettings ? "Saving..." : "Save Notification Settings"}
              </button>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Filters</h2>
          <form onSubmit={handleSearch} className="mt-4 flex flex-wrap items-stretch gap-3">
            <input
              type="text"
              placeholder="Search notifications"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 min-w-[220px] flex-1 rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:ring-indigo-400"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 rounded-lg border border-gray-200 bg-white px-3.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="all">All Status</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-11 rounded-lg border border-gray-200 bg-white px-3.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="all">All Categories</option>
              <option value="System Alert">System Alert</option>
              <option value="User Activity">User Activity</option>
              <option value="Error">Error</option>
              <option value="Security Alert">Security Alert</option>
              <option value="Info">Info</option>
            </select>
            <button
              type="submit"
              className="h-11 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setCategoryFilter("all");
                setSearchQuery("");
                const token = localStorage.getItem("adminToken");
                fetchNotifications(token, 1, "all", "all", "");
              }}
              className="h-11 rounded-lg border border-gray-200 bg-white px-5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Reset
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Notifications</h2>
          </div>

          {loading ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
              No notifications found.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {notifications.map((notification) => {
                  const category = getCategoryColor(notification.category);
                  const priority = getPriorityBadge(notification.priority);
                  const isUnread = notification.status === "unread";
                  const isCritical = notification.priority === "critical";

                  return (
                    <article
                      key={notification.id}
                      className={`rounded-xl border px-4 py-4 transition ${
                        isUnread
                          ? "border-indigo-200 bg-indigo-50/40 dark:border-indigo-900/60 dark:bg-indigo-950/20"
                          : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/20"
                      } ${isCritical ? "shadow-[0_0_0_1px_rgba(239,68,68,0.18)]" : "shadow-sm"}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm">{category.icon}</span>
                            <h3
                              className={`text-sm ${
                                isUnread
                                  ? "font-semibold text-gray-900 dark:text-gray-100"
                                  : "font-medium text-gray-800 dark:text-gray-200"
                              }`}
                            >
                              {notification.title}
                            </h3>
                            {isUnread && (
                              <span className="rounded-md bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                New
                              </span>
                            )}
                            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${category.chip}`}>
                              {notification.category}
                            </span>
                            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${priority.chip}`}>
                              {priority.text}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                            {notification.description}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-3 dark:border-gray-700">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTime(notification.createdAt)}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {isUnread ? (
                            <button
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="h-8 rounded-md border border-indigo-200 bg-indigo-50 px-3 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-950/45"
                            >
                              Mark Read
                            </button>
                          ) : (
                            <button
                              onClick={() => handleMarkAsUnread(notification.id)}
                              className="h-8 rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                            >
                              Mark Unread
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(notification.id)}
                            className="h-8 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-800/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/45"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const token = localStorage.getItem("adminToken");
                      if (currentPage > 1) {
                        fetchNotifications(token, currentPage - 1, statusFilter, categoryFilter, searchQuery);
                      }
                    }}
                    disabled={currentPage <= 1}
                    className="h-9 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => {
                      const token = localStorage.getItem("adminToken");
                      if (currentPage < totalPages) {
                        fetchNotifications(token, currentPage + 1, statusFilter, categoryFilter, searchQuery);
                      }
                    }}
                    disabled={currentPage >= totalPages}
                    className="h-9 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

