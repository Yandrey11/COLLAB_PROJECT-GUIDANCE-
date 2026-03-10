import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import { NotificationBadgeBadge } from "../components/NotificationBadge";
import CounselorSidebar from "../components/CounselorSidebar";
import { initializeTheme } from "../utils/themeUtils";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

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
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
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
    <div className="min-h-screen w-full flex flex-col items-center page-bg font-sans p-4 md:p-8 gap-6">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        {/* Left: Overview / Navigation */}
        <CounselorSidebar />

        {/* Right: Main content */}
        <main className="w-full">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
             
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 m-0">Notification Center</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                  Stay updated with records, assignments, and announcements
                </p>
              </div>
            </div>
            {unreadCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                  {unreadCount} unread
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Message Alert */}
        {message.text && (
          <div
            className={`p-4 rounded-xl font-medium mb-6 ${
              message.type === "success"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm mb-6">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 min-w-[200px] px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                handleFilter();
              }}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-indigo-600 text-white cursor-pointer text-sm font-semibold outline-none"
            >
              <option value="all">All Status</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                handleFilter();
              }}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-indigo-600 text-white cursor-pointer text-sm font-semibold outline-none"
            >
              <option value="all">All Categories</option>
              <option value="New Record">New Record</option>
              <option value="Assigned Record">Assigned Record</option>
              <option value="Updated Record">Updated Record</option>
              <option value="Schedule Reminder">Schedule Reminder</option>
              <option value="Announcement">Announcement</option>
              <option value="System Alert">System Alert</option>
            </select>
            <button
              type="submit"
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold hover:from-indigo-700 hover:to-blue-700 transition-colors text-sm"
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
              className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors font-semibold text-sm"
            >
              Reset
            </button>
          </form>
        </div>

        {/* Action Buttons */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm mb-6 flex flex-wrap gap-3">
          <button
            onClick={handleMarkAllAsRead}
            className="px-4 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors font-semibold text-sm"
          >
            Mark All as Read
          </button>
          <button
            onClick={handleDeleteAllRead}
            className="px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors font-semibold text-sm"
          >
            Delete All Read
          </button>
        </div>

        {/* Notifications List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Notifications</h2>
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p className="text-lg">No notifications found.</p>
              <p className="text-sm mt-2">You're all caught up! 🎉</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {notifications.map((notification) => {
                  const isUnread = notification.status === "unread";
                  const categoryColors = getCategoryColor(notification.category);
                  const priorityBadge = getPriorityBadge(notification.priority);
                  const isCritical = notification.priority === "critical";

                  return (
                    <div
                      key={notification.id}
                      className={`p-2.5 rounded-lg border ${
                        isUnread
                          ? "border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20"
                          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700/50"
                      } ${isCritical ? "shadow-md" : "shadow-sm"} transition-all hover:shadow-md`}
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
                <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const token = localStorage.getItem("token") || localStorage.getItem("authToken");
                        if (currentPage > 1) {
                          fetchNotifications(token, currentPage - 1, statusFilter, categoryFilter, searchQuery);
                        }
                      }}
                      disabled={currentPage <= 1}
                      className={`px-4 py-2 rounded-xl border border-gray-200 font-semibold text-sm ${
                        currentPage <= 1
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-white text-gray-700 hover:bg-gray-50 cursor-pointer"
                      }`}
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => {
                        const token = localStorage.getItem("token") || localStorage.getItem("authToken");
                        if (currentPage < totalPages) {
                          fetchNotifications(token, currentPage + 1, statusFilter, categoryFilter, searchQuery);
                        }
                      }}
                      disabled={currentPage >= totalPages}
                      className={`px-4 py-2 rounded-xl border border-gray-200 font-semibold text-sm ${
                        currentPage >= totalPages
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-white text-gray-700 hover:bg-gray-50 cursor-pointer"
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
        </main>
      </div>
    </div>
  );
}

