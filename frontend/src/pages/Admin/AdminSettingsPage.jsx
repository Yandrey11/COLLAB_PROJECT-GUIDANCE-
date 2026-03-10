import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import AdminSidebar from "../../components/AdminSidebar";
import { applyTheme, initializeTheme } from "../../utils/themeUtils";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { validatePassword } from "../../utils/passwordValidation";
import PasswordStrengthMeter from "../../components/PasswordStrengthMeter.jsx";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const SETTINGS_API_URL = `${BASE_URL}/api/admin/settings`;
const PROFILE_API_URL = `${BASE_URL}/api/admin/profile`;

export default function AdminSettingsPage() {
  useDocumentTitle("Admin Settings");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("account"); // account, display, notifications, privacy
  const [admin, setAdmin] = useState(null);
  const [profile, setProfile] = useState(null);

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Activity logs state
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityPagination, setActivityPagination] = useState(null);
  const [activityLogsExpanded, setActivityLogsExpanded] = useState(true);

  // Settings state
  const [settings, setSettings] = useState({
    display: {
      theme: "light",
      uiDensity: "normal",
      defaultDashboardView: "records",
    },
    notifications: {
      newUserCreations: true,
      recordUpdates: true,
      criticalSystemAlerts: true,
      pdfGenerations: true,
      loginAttempts: false,
      soundEnabled: false,
    },
    privacy: {
      hideProfilePhoto: false,
      maskNameInNotifications: false,
    },
  });

  // Check admin authentication
  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      navigate("/adminlogin");
      return;
    }

    axios
      .get(`${BASE_URL}/api/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (res.data.role !== "admin") {
          navigate("/adminlogin");
          return;
        }
        setAdmin(res.data);
        fetchSettings();
        fetchProfile();
      })
      .catch(() => {
        navigate("/adminlogin");
      });
  }, [navigate]);

  // Initialize theme and fetch settings on mount
  useEffect(() => {
    initializeTheme();
    fetchSettings();
    fetchProfile();
  }, []);

  // Fetch activity logs when account tab is active
  useEffect(() => {
    if (activeTab === "account") {
      fetchActivityLogs();
    }
  }, [activeTab, activityPage]);

  // Fetch profile data
  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) {
        navigate("/adminlogin");
        return;
      }

      const response = await axios.get(PROFILE_API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setProfile(response.data.profile);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  // Fetch activity logs
  const fetchActivityLogs = async () => {
    try {
      setActivityLoading(true);
      const token = localStorage.getItem("adminToken");
      const response = await axios.get(`${PROFILE_API_URL}/activity`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { page: activityPage, limit: 5 },
      });

      if (response.data.success) {
        setActivityLogs(response.data.logs);
        setActivityPagination(response.data.pagination);
      }
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to load activity logs",
      });
    } finally {
      setActivityLoading(false);
    }
  };

  // Format activity date
  const formatActivityDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get activity icon
  const getActivityIcon = (activityType) => {
    const icons = {
      profile_viewed: "👁️",
      profile_updated: "✏️",
      password_changed: "🔒",
      profile_picture_updated: "📷",
      profile_picture_removed: "🗑️",
      account_activity_viewed: "📋",
      email_updated: "📧",
      name_updated: "✏️",
      settings_updated: "⚙️",
      display_settings_updated: "🎨",
      notification_settings_updated: "🔔",
      privacy_settings_updated: "🔐",
      login: "🔑",
      logout: "🚪",
    };
    return icons[activityType] || "📌";
  };

  // Fetch settings from backend
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("adminToken");
      if (!token) {
        navigate("/adminlogin");
        return;
      }

      const response = await axios.get(SETTINGS_API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        setSettings((prev) => ({
          ...prev,
          ...response.data.settings,
        }));

        // Apply theme immediately
        if (response.data.settings.display?.theme) {
          applyTheme(response.data.settings.display.theme);
          localStorage.setItem("theme", response.data.settings.display.theme);
        }
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  // Update setting
  const updateSetting = (category, key, value) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));

    // For display settings, apply immediately (frontend-only)
    if (category === "display" && key === "theme") {
      applyTheme(value);
      localStorage.setItem("theme", value);
    }
  };

  // Save settings to backend
  const saveSettings = async (category = null) => {
    try {
      setSaving(true);
      const token = localStorage.getItem("adminToken");
      if (!token) {
        navigate("/adminlogin");
        return;
      }

      // Save based on category
      let endpoint = SETTINGS_API_URL;
      let settingsToSave = {};

      if (category === "display") {
        endpoint = `${SETTINGS_API_URL}/display`;
        settingsToSave = settings.display;
      } else if (category === "notifications") {
        endpoint = `${SETTINGS_API_URL}/notifications`;
        settingsToSave = settings.notifications;
      } else if (category === "privacy") {
        endpoint = `${SETTINGS_API_URL}/privacy`;
        settingsToSave = settings.privacy;
      } else {
        settingsToSave = {
          display: settings.display,
          notifications: settings.notifications,
          privacy: settings.privacy,
        };
      }

      const response = await axios.put(endpoint, settingsToSave, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.data.success) {
        await Swal.fire({
          icon: "success",
          title: "Settings Saved!",
          text: "Your settings have been updated successfully.",
          timer: 2000,
          showConfirmButton: false,
        });

        // Update settings from response
        if (response.data.settings) {
          setSettings((prev) => ({
            ...prev,
            [category]: response.data.settings,
          }));
        }
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      Swal.fire({
        icon: "error",
        title: "Save Failed",
        text: error.response?.data?.message || "Failed to save settings. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle password change
  const handlePasswordChange = async (e) => {
    e.preventDefault();

    // Validation
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Swal.fire({
        icon: "error",
        title: "Password Mismatch",
        text: "New password and confirm password do not match",
      });
      return;
    }

    // Enhanced password validation
    const validation = validatePassword(passwordForm.newPassword, {
      email: profile?.email || admin?.email || "",
      name: profile?.name || admin?.name || "",
    });

    if (!validation.isValid) {
      Swal.fire({
        icon: "error",
        title: "Password Requirements Not Met",
        html: `<ul style="text-align:left;margin:0;padding-left:1.2rem;">${validation.hints.length > 0 ? validation.hints.map((hint) => `<li>${hint}</li>`).join("") : validation.errors.map((err) => `<li>${err}</li>`).join("")}</ul>`,
      });
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem("adminToken");
      const response = await axios.put(
        `${PROFILE_API_URL}/password`,
        {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        await Swal.fire({
          icon: "success",
          title: "Success!",
          text: "Password changed successfully",
          timer: 2000,
          showConfirmButton: false,
        });
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      }
    } catch (error) {
      console.error("Error changing password:", error);
      Swal.fire({
        icon: "error",
        title: "Change Failed",
        text: error.response?.data?.message || "Failed to change password",
        footer: error.response?.data?.errors
          ? `<ul style="text-align: left; margin-top: 10px;">${error.response.data.errors
              .map((err) => `<li>${err}</li>`)
              .join("")}</ul>`
          : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  // Logout handler
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
      localStorage.removeItem("admin");
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
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        {/* Left: AdminSidebar */}
        <AdminSidebar />

        {/* Right: Main Settings Content */}
        <main className="flex-1">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm mb-6"
          >
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 m-0">Settings</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                  Manage your account preferences, display options, and privacy settings.
                </p>
              </div>
              <button
                onClick={() => navigate("/admin/profile")}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                <span>👤</span>
                Profile
              </button>
            </div>
          </motion.div>

          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm mb-6"
          >
            <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
              {[
                { id: "account", label: "Account Settings", icon: "👤" },
                { id: "display", label: "Display & Interface", icon: "🎨" },
                { id: "notifications", label: "Notifications", icon: "🔔" },
                { id: "privacy", label: "Privacy", icon: "🔒" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                    activeTab === tab.id
                      ? "bg-indigo-600 dark:bg-indigo-500 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              {/* Account Settings Tab */}
              {activeTab === "account" && (
                <motion.div
                  key="account"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Account Settings</h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                      Manage your personal information, password, and account preferences.
                    </p>

                    {/* Change Password Section */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6 mb-6">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Change Password</h3>
                      <form onSubmit={handlePasswordChange}>
                        <div className="flex flex-col gap-4 max-w-md">
                          <div>
                            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                              Current Password *
                            </label>
                            <input
                              type="password"
                              value={passwordForm.currentPassword}
                              onChange={(e) =>
                                setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                              }
                              required
                              className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                              New Password *
                            </label>
                            <input
                              type="password"
                              value={passwordForm.newPassword}
                              onChange={(e) =>
                                setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                              }
                              required
                              className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <div className="mt-1">
                              <PasswordStrengthMeter
                                password={passwordForm.newPassword}
                                email={profile?.email || admin?.email || ""}
                                name={profile?.name || admin?.name || ""}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                              Confirm New Password *
                            </label>
                            <input
                              type="password"
                              value={passwordForm.confirmPassword}
                              onChange={(e) =>
                                setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                              }
                              required
                              minLength={8}
                              className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <motion.button
                            type="submit"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            disabled={saving}
                            className="px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-700 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                          >
                            {saving ? "Changing..." : "Change Password"}
                          </motion.button>
                        </div>
                      </form>
                    </div>

                    {/* Profile Management Section */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Profile Management</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Update your personal information and profile picture
                          </p>
                        </div>
                        <button
                          onClick={() => navigate("/admin/profile")}
                          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
                        >
                          Go to Profile
                        </button>
                      </div>
                    </div>

                    {/* Activity Logs Section */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Account Activity Logs</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            View your account activity history (read-only)
                          </p>
                        </div>
                        <button
                          onClick={() => setActivityLogsExpanded(!activityLogsExpanded)}
                          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                          aria-label={activityLogsExpanded ? "Minimize" : "Expand"}
                        >
                          {activityLogsExpanded ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5 text-gray-600 dark:text-gray-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5 text-gray-600 dark:text-gray-400"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          )}
                        </button>
                      </div>
                      {activityLogsExpanded && (
                        <>
                          {activityLoading ? (
                            <div className="text-center py-12">
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"
                              />
                            </div>
                          ) : activityLogs.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                              No activity logs found.
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-col gap-3">
                                {activityLogs.map((log, index) => (
                                  <motion.div
                                    key={log._id || index}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700"
                                  >
                                    <div className="flex gap-3 items-start">
                                      <div className="text-2xl">{getActivityIcon(log.activityType)}</div>
                                      <div className="flex-1">
                                        <div className="flex justify-between items-start flex-wrap gap-2">
                                          <div>
                                            <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                              {log.description}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                              {formatActivityDate(log.createdAt || log.timestamp)}
                                            </div>
                                          </div>
                                          <div className="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-xs font-semibold capitalize">
                                            {log.activityType.replace(/_/g, " ")}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                              {activityPagination && activityPagination.totalPages > 1 && (
                                <div className="flex justify-center items-center gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                                    disabled={activityPage === 1}
                                    className={`px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 font-semibold text-sm ${
                                      activityPage === 1
                                        ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50"
                                        : "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600"
                                    }`}
                                  >
                                    Previous
                                  </motion.button>
                                  <span className="text-gray-600 dark:text-gray-400 text-sm">
                                    Page {activityPage} of {activityPagination.totalPages}
                                  </span>
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setActivityPage((p) => Math.min(activityPagination.totalPages, p + 1))}
                                    disabled={activityPage === activityPagination.totalPages}
                                    className={`px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 font-semibold text-sm ${
                                      activityPage === activityPagination.totalPages
                                        ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-50"
                                        : "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600"
                                    }`}
                                  >
                                    Next
                                  </motion.button>
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Display & Interface Settings Tab */}
              {activeTab === "display" && (
                <motion.div
                  key="display"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Display & Interface Settings</h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                      Customize your interface appearance and default views.
                    </p>

                    {/* Theme Selection */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mb-4">
                      <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        Theme
                      </label>
                      <div className="flex gap-3">
                        <button
                          onClick={() => updateSetting("display", "theme", "light")}
                          className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                            settings.display.theme === "light"
                              ? "border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                          }`}
                        >
                          <div className="text-center">
                            <div className="text-2xl mb-2">☀️</div>
                            <div className={`font-semibold text-sm ${
                              settings.display.theme === "light"
                                ? "text-indigo-900 dark:text-indigo-200"
                                : "text-gray-900 dark:text-gray-100"
                            }`}>Light Mode</div>
                          </div>
                        </button>
                        <button
                          onClick={() => updateSetting("display", "theme", "dark")}
                          className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                            settings.display.theme === "dark"
                              ? "border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                          }`}
                        >
                          <div className="text-center">
                            <div className="text-2xl mb-2">🌙</div>
                            <div className={`font-semibold text-sm ${
                              settings.display.theme === "dark"
                                ? "text-indigo-900 dark:text-indigo-200"
                                : "text-gray-900 dark:text-gray-100"
                            }`}>Dark Mode</div>
                          </div>
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => saveSettings("display")}
                      disabled={saving}
                      className="w-full px-6 py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? "Saving..." : "Save Display Settings"}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Notification Settings Tab */}
              {activeTab === "notifications" && (
                <motion.div
                  key="notifications"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Notification Settings</h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                      Control which notifications you receive and how they're delivered.
                    </p>

                    {/* Notification Toggles */}
                    <div className="space-y-4">
                      {[
                        {
                          key: "newUserCreations",
                          label: "New User Creations",
                          description: "Receive notifications when new users are created",
                        },
                        {
                          key: "recordUpdates",
                          label: "Record Updates",
                          description: "Receive notifications when counseling records are updated",
                        },
                        {
                          key: "criticalSystemAlerts",
                          label: "Critical System Alerts",
                          description: "Receive notifications for critical system events",
                        },
                        {
                          key: "pdfGenerations",
                          label: "PDF Generations",
                          description: "Receive notifications when PDFs are generated",
                        },
                        {
                          key: "loginAttempts",
                          label: "Login Attempts",
                          description: "Receive notifications for login attempts (admin only)",
                        },
                        {
                          key: "soundEnabled",
                          label: "Notification Sound",
                          description: "Play a sound when receiving new notifications",
                        },
                      ].map((item) => (
                        <div
                          key={item.key}
                          className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 flex items-center justify-between"
                        >
                          <div className="flex-1">
                            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                              {item.label}
                            </label>
                            <p className="text-xs text-gray-600 dark:text-gray-400">{item.description}</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.notifications[item.key]}
                              onChange={(e) =>
                                updateSetting("notifications", item.key, e.target.checked)
                              }
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => saveSettings("notifications")}
                      disabled={saving}
                      className="w-full mt-6 px-6 py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? "Saving..." : "Save Notification Settings"}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Privacy Settings Tab */}
              {activeTab === "privacy" && (
                <motion.div
                  key="privacy"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Privacy Settings</h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                      Control how your information is displayed and shared within the system.
                    </p>

                    {/* Privacy Toggles */}
                    <div className="space-y-4">
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex-1">
                          <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                            Hide Profile Photo
                          </label>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Hide your profile picture from other users
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.privacy.hideProfilePhoto}
                            onChange={(e) =>
                              updateSetting("privacy", "hideProfilePhoto", e.target.checked)
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex-1">
                          <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                            Mask Name in Notifications
                          </label>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Mask your name in automatically generated system notifications
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.privacy.maskNameInNotifications}
                            onChange={(e) =>
                              updateSetting("privacy", "maskNameInNotifications", e.target.checked)
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                    </div>

                    <button
                      onClick={() => saveSettings("privacy")}
                      disabled={saving}
                      className="w-full mt-6 px-6 py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? "Saving..." : "Save Privacy Settings"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </main>
      </div>
    </div>
  );
}

