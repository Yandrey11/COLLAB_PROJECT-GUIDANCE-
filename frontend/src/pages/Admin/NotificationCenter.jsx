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
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });

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
        await fetchNotifications(token, 1, "all", "all", "");
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

  const handleFilter = async () => {
    const token = localStorage.getItem("adminToken");
    setCurrentPage(1); // Reset to first page when filtering
    await fetchNotifications(token, 1, statusFilter, categoryFilter, searchQuery);
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
        return { bg: "rgba(59,130,246,0.1)", color: "#2563eb", icon: "⚠️" };
      case "User Activity":
        return { bg: "rgba(16,185,129,0.1)", color: "#10b981", icon: "👤" };
      case "Error":
        return { bg: "rgba(239,68,68,0.1)", color: "#dc2626", icon: "❌" };
      case "Security Alert":
        return { bg: "rgba(245,158,11,0.1)", color: "#f59e0b", icon: "🔒" };
      default:
        return { bg: "rgba(107,114,128,0.1)", color: "#6b7280", icon: "ℹ️" };
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case "critical":
        return { bg: "#dc2626", color: "#fff", text: "Critical" };
      case "high":
        return { bg: "#f59e0b", color: "#fff", text: "High" };
      case "medium":
        return { bg: "#3b82f6", color: "#fff", text: "Medium" };
      default:
        return { bg: "#6b7280", color: "#fff", text: "Low" };
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center page-bg font-sans p-4 md:p-8 gap-6">
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        <AdminSidebar />

        <div className="flex flex-col gap-5">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 m-0">Notification Center</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5">
                  Manage and monitor system notifications and alerts.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <div className="px-4 py-2 rounded-lg bg-red-500 text-white font-semibold text-sm">
                    {unreadCount} Unread
                  </div>
                )}
                <button
                  onClick={handleMarkAllAsRead}
                  className="px-5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 cursor-pointer font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Mark All Read
                </button>
                <button
                  onClick={handleDeleteAllRead}
                  className="px-5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 cursor-pointer font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Delete Read
                </button>
              </div>
            </div>
          </div>

        {/* Message Alert */}
        {message.text && (
          <div
            className={`px-5 py-3 rounded-lg font-medium text-sm ${
              message.type === "success"
                ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm">
          <form onSubmit={handleSearch} className="flex gap-3 items-stretch flex-wrap w-full">
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 min-w-[200px] px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 placeholder-gray-400 dark:placeholder-gray-500"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-indigo-600 dark:bg-indigo-600 text-white text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-indigo-600 dark:bg-indigo-600 text-white text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Categories</option>
              <option value="System Alert">System Alert</option>
              <option value="User Activity">User Activity</option>
              <option value="Error">Error</option>
              <option value="Security Alert">Security Alert</option>
              <option value="Info">Info</option>
            </select>
            <div className="flex gap-2 flex-wrap">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold text-sm cursor-pointer transition-all shadow-md hover:shadow-lg"
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
                className="px-5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 cursor-pointer font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        {/* Notifications List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-indigo-600 dark:text-indigo-400 mt-0 font-bold">Notifications</h2>
          {notifications.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
              No notifications found.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {notifications.map((notification) => {
                  const categoryColors = getCategoryColor(notification.category);
                  const priorityBadge = getPriorityBadge(notification.priority);
                  const isUnread = notification.status === "unread";
                  const isCritical = notification.priority === "critical";

                  return (
                    <div
                      key={notification.id}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        className: isUnread 
                          ? "border-2 border-indigo-600 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20" 
                          : "border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700",
                        boxShadow: isCritical ? "0 2px 6px rgba(220,38,38,0.1)" : "0 1px 4px rgba(0,0,0,0.02)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 14 }}>{categoryColors.icon}</span>
                            <h3
                              style={{
                                margin: 0,
                                color: "#111827",
                                fontWeight: isUnread ? 700 : 600,
                                fontSize: 13,
                              }}
                            >
                              {notification.title}
                            </h3>
                            {isUnread && (
                              <span
                                style={{
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background: "#4f46e5",
                                  color: "#fff",
                                  fontSize: 9,
                                  fontWeight: 600,
                                }}
                              >
                                NEW
                              </span>
                            )}
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 6,
                                fontSize: 9,
                                fontWeight: 600,
                                background: categoryColors.bg,
                                color: categoryColors.color,
                              }}
                            >
                              {notification.category}
                            </span>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 6,
                                fontSize: 9,
                                fontWeight: 600,
                                background: priorityBadge.bg,
                                color: priorityBadge.color,
                              }}
                            >
                              {priorityBadge.text}
                            </span>
                          </div>
                          <p style={{ color: "#6b7280", margin: "4px 0", fontSize: 12, lineHeight: 1.4 }}>
                            {notification.description}
                          </p>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                            <span style={{ color: "#9ca3af", fontSize: 10 }}>
                              {formatTime(notification.createdAt)}
                            </span>
                            <div style={{ display: "flex", gap: 6 }}>
                              {isUnread ? (
                                <button
                                  onClick={() => handleMarkAsRead(notification.id)}
                                  className="px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 cursor-pointer font-semibold text-xs hover:bg-gray-50 dark:hover:bg-gray-600"
                                >
                                  Mark Read
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleMarkAsUnread(notification.id)}
                                  className="px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 cursor-pointer font-semibold text-xs hover:bg-gray-50 dark:hover:bg-gray-600"
                                >
                                  Mark Unread
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(notification.id)}
                                className="px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 cursor-pointer font-semibold text-xs hover:bg-gray-50 dark:hover:bg-gray-600"
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
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: "1px solid #f3f4f6",
                }}
              >
                <div style={{ color: "#6b7280", fontSize: 14 }}>
                  Page {currentPage} of {totalPages}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      const token = localStorage.getItem("adminToken");
                      if (currentPage > 1) {
                        fetchNotifications(token, currentPage - 1, statusFilter, categoryFilter, searchQuery);
                      }
                    }}
                    disabled={currentPage <= 1}
                    className={`px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 ${currentPage <= 1 ? "bg-gray-100 dark:bg-gray-700 cursor-not-allowed text-gray-400 dark:text-gray-500" : "bg-white dark:bg-gray-700 cursor-pointer text-gray-900 dark:text-gray-100"} font-semibold`}
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
                    className={`px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 ${currentPage >= totalPages ? "bg-gray-100 dark:bg-gray-700 cursor-not-allowed text-gray-400 dark:text-gray-500" : "bg-white dark:bg-gray-700 cursor-pointer text-gray-900 dark:text-gray-100"} font-semibold`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Close grid container */}
      </div>
    </div>
  );
}

