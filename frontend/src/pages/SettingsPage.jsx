import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import { NotificationBadgeBadge } from "../components/NotificationBadge";
import CounselorSidebar from "../components/CounselorSidebar";
import ColorThemeSection from "../components/ColorThemeSection";
import {
  applyTheme,
  initializeTheme,
  applyColorTheme,
  persistColorTheme,
  resetColorThemeToDefault,
  COLOR_DEFAULTS,
} from "../utils/themeUtils";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { validatePassword } from "../utils/passwordValidation";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter.jsx";
import { API_BASE_URL } from "../config/apiBaseUrl";

const BASE_URL = API_BASE_URL;
const SETTINGS_API_URL = `${BASE_URL}/api/counselor/settings`;
const PROFILE_API_URL = `${BASE_URL}/api/profile`;

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

const settingsPanel =
  "rounded-xl border border-gray-100 dark:border-gray-700/90 bg-white/90 dark:bg-gray-900/25 p-5";

export default function SettingsPage() {
  useDocumentTitle("Settings");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("account"); // account, display, notifications, calendar, privacy
  const [user, setUser] = useState(null);
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
      defaultDashboardView: "calendar",
    },
    notifications: {
      recordUpdates: true,
      adminAnnouncements: true,
      googleCalendarSync: true,
      soundEnabled: false,
    },
    googleCalendar: {
      showOnDashboard: true,
      preferredView: "month",
    },
    privacy: {
      hideProfilePhoto: false,
      maskNameInPDFs: false,
    },
    colors: { ...COLOR_DEFAULTS.counselor },
  });

  // Load user from localStorage
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

  // Initialize theme and fetch settings on mount
  useEffect(() => {
    initializeTheme(); // Initialize theme on page load
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
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
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
      const token = localStorage.getItem("token");
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
      profile_picture_uploaded: "📷",
      profile_picture_removed: "🗑️",
      account_activity_viewed: "📋",
      email_updated: "📧",
      name_updated: "✏️",
      login: "🔑",
      logout: "🚪",
    };
    return icons[activityType] || "📌";
  };

  // Fetch settings from backend
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
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

        // Apply persisted color theme if available
        if (response.data.settings.colors) {
          applyColorTheme(response.data.settings.colors);
          persistColorTheme(response.data.settings.colors);
        }

        // Save to localStorage for frontend-only settings
        saveFrontendSettingsToLocalStorage(response.data.settings);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      // Load from localStorage if backend fetch fails
      loadFrontendSettingsFromLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  // Save frontend settings to localStorage
  const saveFrontendSettingsToLocalStorage = (settingsData) => {
    try {
      const frontendSettings = {
        display: settingsData.display || settings.display,
        googleCalendar: settingsData.googleCalendar || settings.googleCalendar,
      };
      localStorage.setItem("counselorSettings", JSON.stringify(frontendSettings));
    } catch (error) {
      console.error("Error saving settings to localStorage:", error);
    }
  };

  // Load frontend settings from localStorage
  const loadFrontendSettingsFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem("counselorSettings");
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings((prev) => ({
          ...prev,
          display: { ...prev.display, ...parsed.display },
          googleCalendar: { ...prev.googleCalendar, ...parsed.googleCalendar },
        }));
        if (parsed.display?.theme) {
          applyTheme(parsed.display.theme);
          localStorage.setItem("theme", parsed.display.theme);
        }
      }
    } catch (error) {
      console.error("Error loading settings from localStorage:", error);
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

    // Save frontend-only settings to localStorage immediately
    if (category === "display" || category === "googleCalendar") {
      const frontendSettings = {
        display: category === "display" ? { ...settings.display, [key]: value } : settings.display,
        googleCalendar: category === "googleCalendar" ? { ...settings.googleCalendar, [key]: value } : settings.googleCalendar,
      };
      localStorage.setItem("counselorSettings", JSON.stringify(frontendSettings));
    }
  };

  // Save settings to backend
  const saveSettings = async (category = null) => {
    if (saving) return;
    try {
      setSaving(true);
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      // Only save backend-relevant settings (notifications, privacy, and optionally display)
      const settingsToSave = category
        ? { [category]: settings[category] }
        : {
            display: settings.display,
            notifications: settings.notifications,
            privacy: settings.privacy,
          };

      const response = await axios.put(SETTINGS_API_URL, settingsToSave, {
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
            ...response.data.settings,
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

  // Save color theme to backend
  const saveColors = async (colors) => {
    if (saving) return;
    try {
      setSaving(true);
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }
      const response = await axios.put(
        SETTINGS_API_URL,
        { colors },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (response.data.success) {
        const next = response.data.settings?.colors || colors;
        setSettings((prev) => ({ ...prev, colors: next }));
        applyColorTheme(next);
        persistColorTheme(next);
        await Swal.fire({
          icon: "success",
          title: "Theme saved",
          text: "Your color preferences have been updated.",
          timer: 1800,
          showConfirmButton: false,
        });
      }
    } catch (error) {
      console.error("Error saving theme colors:", error);
      Swal.fire({
        icon: "error",
        title: "Save failed",
        text: error.response?.data?.message || "Failed to save theme colors.",
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset just the color theme (without resetting other settings)
  const resetColorsOnly = async () => {
    if (saving) return;
    const def = { ...COLOR_DEFAULTS.counselor };
    setSettings((prev) => ({ ...prev, colors: def }));
    applyColorTheme(def);
    persistColorTheme(def);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await axios.put(
        SETTINGS_API_URL,
        { colors: def },
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );
    } catch (e) {
      console.warn("Failed to persist color reset:", e);
    }
  };

  // Handle password change
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (saving) return;

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
      email: profile?.email || user?.email || "",
      name: profile?.name || user?.name || "",
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
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      const response = await axios.post(
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

  // Reset settings to defaults
  const resetSettings = async () => {
    if (saving) return;
    const result = await Swal.fire({
      title: "Reset Settings?",
      text: "Are you sure you want to reset all settings to defaults?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, reset",
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      try {
        setSaving(true);
        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/login");
          return;
        }

        const response = await axios.post(
          `${SETTINGS_API_URL}/reset`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.data.success) {
          setSettings({
            display: {
              theme: "light",
              uiDensity: "normal",
              defaultDashboardView: "calendar",
            },
            notifications: {
              recordUpdates: true,
              adminAnnouncements: true,
              googleCalendarSync: true,
              soundEnabled: false,
            },
            googleCalendar: {
              showOnDashboard: true,
              preferredView: "month",
            },
            privacy: {
              hideProfilePhoto: false,
              maskNameInPDFs: false,
            },
            colors: { ...COLOR_DEFAULTS.counselor },
          });

          applyTheme("light");
          resetColorThemeToDefault("counselor");
          localStorage.removeItem("counselorSettings");

          await Swal.fire({
            icon: "success",
            title: "Settings Reset!",
            text: "All settings have been reset to defaults.",
            timer: 2000,
            showConfirmButton: false,
          });
        }
      } catch (error) {
        console.error("Error resetting settings:", error);
        Swal.fire({
          icon: "error",
          title: "Reset Failed",
          text: error.response?.data?.message || "Failed to reset settings. Please try again.",
        });
      } finally {
        setSaving(false);
      }
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
      const token = localStorage.getItem("authToken") || localStorage.getItem("token");
      try {
        if (token) {
          await fetch(`${BASE_URL}/api/auth/logout`, {
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
            className="flex flex-col gap-5 border-b border-gray-200/80 pb-8 dark:border-gray-700/80 sm:flex-row sm:items-center sm:justify-between sm:gap-6 lg:pb-10"
          >
            <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-5">
              <CounselorSidebar variant="header" />
              <div className="hidden h-10 w-px shrink-0 bg-gray-200 dark:bg-gray-700 sm:block" aria-hidden />
              <div className="min-w-0">
                <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                  Preferences
                </p>
                <h1 className="mt-1.5 m-0 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 sm:text-3xl">
                  Settings
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  Account security, appearance, notifications, and privacy.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 sm:justify-end">
              <button
                type="button"
                onClick={resetSettings}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
                disabled={saving}
              >
                Reset to defaults
              </button>
            </div>
          </motion.header>

          <motion.section
            variants={pageItem}
            className="rounded-2xl border border-gray-200/90 bg-white dark:border-gray-700/90 dark:bg-gray-800/80"
          >
            <div className="border-b border-gray-100 px-4 py-4 dark:border-gray-700/80 sm:px-6 sm:py-5">
              <nav className="flex flex-wrap gap-2" aria-label="Settings sections">
              {[
                { id: "account", label: "Account" },
                { id: "display", label: "Display" },
                { id: "notifications", label: "Notifications" },
                { id: "privacy", label: "Privacy" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "btn-theme-primary"
                      : "border border-transparent text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-900/40"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              </nav>
            </div>

            <div className="p-5 sm:p-6 lg:p-8">

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
                  <div className="mb-8">
                    <h2 className="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">Account</h2>
                    <p className="mt-2 m-0 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                      Password, profile shortcut, and sign-in activity.
                    </p>

                    {/* Change Password Section */}
                    <div className={`${settingsPanel} mb-5`}>
                      <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Change password</h3>
                      {profile?.isGoogleUser ? (
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-200">
                          <strong>Note:</strong> You are using Google authentication. To change your password, please use your Google account settings.
                        </div>
                      ) : (
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
                                  email={profile?.email || user?.email || ""}
                                  name={profile?.name || user?.name || ""}
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
                              className="btn-theme-primary rounded-xl px-5 py-2.5 text-sm font-medium"
                            >
                              {saving ? "Updating…" : "Change password"}
                            </motion.button>
                          </div>
                        </form>
                      )}
                    </div>

                    {/* Profile Management Section */}
                    <div className={`${settingsPanel} mb-5`}>
                      <div className="mb-1 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Profile</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Update your personal information and profile picture
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate("/profile")}
                          className="btn-theme-primary shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium"
                        >
                          Open profile
                        </button>
                      </div>
                    </div>

                    {/* Activity Logs Section */}
                    <div className={settingsPanel}>
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Activity log</h3>
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
                                className="mx-auto h-10 w-10 rounded-full border-2 border-gray-200 border-t-gray-800 dark:border-gray-600 dark:border-t-gray-200"
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
                                    className="rounded-xl border border-gray-100 bg-white/90 p-4 dark:border-gray-700 dark:bg-gray-900/30"
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
                                              {formatActivityDate(log.createdAt)}
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
                  <div className="mb-8">
                    <h2 className="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">Display</h2>
                    <p className="mt-2 m-0 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                      Theme and how the app feels day to day.
                    </p>

                    {/* Theme Selection */}
                    <div className={`${settingsPanel} mb-5`}>
                      <label className="mb-3 block text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Theme
                      </label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => updateSetting("display", "theme", "light")}
                          className={`flex-1 rounded-xl border p-4 transition-colors ${
                            settings.display.theme === "light"
                              ? "border-gray-900 bg-gray-50 dark:border-gray-100 dark:bg-gray-800"
                              : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500"
                          }`}
                        >
                          <div className="text-center">
                            <div className={`text-sm font-semibold ${
                              settings.display.theme === "light"
                                ? "text-gray-900 dark:text-gray-100"
                                : "text-gray-700 dark:text-gray-300"
                            }`}>Light</div>
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Bright surfaces</div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSetting("display", "theme", "dark")}
                          className={`flex-1 rounded-xl border p-4 transition-colors ${
                            settings.display.theme === "dark"
                              ? "border-gray-900 bg-gray-50 dark:border-gray-100 dark:bg-gray-800"
                              : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500"
                          }`}
                        >
                          <div className="text-center">
                            <div className={`text-sm font-semibold ${
                              settings.display.theme === "dark"
                                ? "text-gray-900 dark:text-gray-100"
                                : "text-gray-700 dark:text-gray-300"
                            }`}>Dark</div>
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Low glare</div>
                          </div>
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => saveSettings("display")}
                      disabled={saving}
                      className="btn-theme-primary w-full rounded-xl px-4 py-3 text-sm font-medium"
                    >
                      {saving ? "Saving…" : "Save display settings"}
                    </button>

                    <div className="mt-6">
                      <ColorThemeSection
                        role="counselor"
                        initialColors={settings.colors}
                        saving={saving}
                        onSave={saveColors}
                        onReset={resetColorsOnly}
                      />
                    </div>
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
                  <div className="mb-8">
                    <h2 className="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">Notifications</h2>
                    <p className="mt-2 m-0 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                      Choose what you want to hear about in the app.
                    </p>

                    {/* Notification Toggles */}
                    <div className="space-y-4">
                      {[
                        {
                          key: "recordUpdates",
                          label: "Record Update Notifications",
                          description: "Get notified when records are created, updated, or assigned to you",
                        },
                        {
                          key: "adminAnnouncements",
                          label: "Admin Announcements",
                          description: "Receive notifications for important announcements from administrators",
                        },
                        {
                          key: "soundEnabled",
                          label: "Notification Sound",
                          description: "Play a sound when receiving new notifications",
                        },
                      ].map((item) => (
                        <div
                          key={item.key}
                          className={`${settingsPanel} flex items-center justify-between`}
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
                      type="button"
                      onClick={() => saveSettings("notifications")}
                      disabled={saving}
                      className="btn-theme-primary mt-6 w-full rounded-xl px-4 py-3 text-sm font-medium"
                    >
                      {saving ? "Saving…" : "Save notification settings"}
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
                  <div className="mb-8">
                    <h2 className="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">Privacy</h2>
                    <p className="mt-2 m-0 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                      Limit how your identity appears to admins and in exports.
                    </p>

                    {/* Privacy Toggles */}
                    <div className="flex flex-col gap-4">
                      <div className={`${settingsPanel} flex items-center justify-between`}>
                        <div className="flex-1">
                          <label className="mb-1 block text-sm font-semibold text-gray-900 dark:text-gray-100">
                            Hide profile photo from admin
                          </label>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Prevent administrators from viewing your profile picture in admin panels
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

                      <div className={`${settingsPanel} flex items-center justify-between`}>
                        <div className="flex-1">
                          <label className="mb-1 block text-sm font-semibold text-gray-900 dark:text-gray-100">
                            Mask name in PDF exports
                          </label>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Replace your name with a generic identifier in automatically generated PDF reports (if allowed by system policy)
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.privacy.maskNameInPDFs}
                            onChange={(e) =>
                              updateSetting("privacy", "maskNameInPDFs", e.target.checked)
                            }
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => saveSettings("privacy")}
                      disabled={saving}
                      className="btn-theme-primary mt-6 w-full rounded-xl px-4 py-3 text-sm font-medium"
                    >
                      {saving ? "Saving…" : "Save privacy settings"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            </div>
          </motion.section>
        </motion.main>
      </div>
    </div>
  );
}

