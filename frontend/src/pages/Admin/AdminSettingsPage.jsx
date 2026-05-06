import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import AdminSidebar from "../../components/AdminSidebar";
import ColorThemeSection from "../../components/ColorThemeSection";
import {
  applyTheme,
  initializeTheme,
  applyColorTheme,
  persistColorTheme,
  COLOR_DEFAULTS,
} from "../../utils/themeUtils";
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
  const [activeTab, setActiveTab] = useState("account"); // account, display, privacy
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
    colors: { ...COLOR_DEFAULTS.admin },
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

        // Apply persisted color theme if available
        if (response.data.settings.colors) {
          applyColorTheme(response.data.settings.colors);
          persistColorTheme(response.data.settings.colors);
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

  // Save admin color theme
  const saveColors = async (colors) => {
    try {
      setSaving(true);
      const token = localStorage.getItem("adminToken");
      if (!token) {
        navigate("/adminlogin");
        return;
      }
      const response = await axios.put(
        `${SETTINGS_API_URL}/colors`,
        colors,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (response.data.success) {
        const next = response.data.settings || colors;
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

  // Reset admin color theme to defaults (server + local)
  const resetColorsOnly = async () => {
    const def = { ...COLOR_DEFAULTS.admin };
    setSettings((prev) => ({ ...prev, colors: def }));
    applyColorTheme(def);
    persistColorTheme(def);
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) return;
      await axios.post(
        `${SETTINGS_API_URL}/colors/reset`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e) {
      console.warn("Failed to persist color reset:", e);
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

  const inputClass =
    "h-10 w-full max-w-md rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/25";

  const tabs = [
    { id: "account", label: "Account" },
    { id: "display", label: "Display" },
    { id: "privacy", label: "Privacy" },
  ];

  return (
    <div className="page-bg admin-typography min-h-screen w-full font-sans text-gray-900 dark:text-gray-100">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <main className="flex min-w-0 flex-col gap-8">
          <motion.header
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6 border-b border-gray-200/80 pb-8 dark:border-gray-700/80"
          >
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <AdminSidebar variant="header" />
              <div className="hidden h-10 w-px shrink-0 bg-gray-200 dark:bg-gray-700 sm:block" aria-hidden />
              <div className="min-w-0 space-y-2">
                <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                  Administration
                </p>
                <h1 className="m-0 text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
                <p className="m-0 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  Account security, appearance, and privacy preferences for your admin session.
                </p>
              </div>
            </div>

            <nav
              className="flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-gray-50/80 p-1 dark:border-gray-700 dark:bg-gray-900/40"
              aria-label="Settings sections"
            >
              {tabs.map((tab) => {
                const on = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`min-h-[40px] flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium transition-colors sm:flex-none sm:px-5 ${
                      on
                        ? "bg-white text-indigo-700 shadow-sm dark:bg-gray-800 dark:text-indigo-300"
                        : "text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </motion.header>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/95 sm:p-8"
          >
            <AnimatePresence mode="wait">
              {activeTab === "account" && (
                <motion.div
                  key="account"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-10"
                >
                  <div>
                    <p className="m-0 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      Security
                    </p>
                    <h2 className="mt-1 m-0 text-lg font-semibold text-gray-900 dark:text-gray-100">Password</h2>
                    <p className="mt-1 m-0 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                      Use a strong password you do not reuse elsewhere.
                    </p>
                    <form
                      onSubmit={handlePasswordChange}
                      className="mt-6 max-w-md space-y-4 rounded-xl border border-gray-100 bg-gray-50/60 p-5 dark:border-gray-700 dark:bg-gray-900/35"
                    >
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
                          Current password
                        </label>
                        <input
                          type="password"
                          value={passwordForm.currentPassword}
                          onChange={(e) =>
                            setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                          }
                          required
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
                          New password
                        </label>
                        <input
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={(e) =>
                            setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                          }
                          required
                          className={inputClass}
                        />
                        <div className="mt-2">
                          <PasswordStrengthMeter
                            password={passwordForm.newPassword}
                            email={profile?.email || admin?.email || ""}
                            name={profile?.name || admin?.name || ""}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
                          Confirm new password
                        </label>
                        <input
                          type="password"
                          value={passwordForm.confirmPassword}
                          onChange={(e) =>
                            setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                          }
                          required
                          minLength={8}
                          className={inputClass}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={saving}
                        className="btn-theme-primary h-10 w-full max-w-md rounded-lg text-sm font-medium sm:w-auto sm:px-6"
                      >
                        {saving ? "Updating…" : "Update password"}
                      </button>
                    </form>
                  </div>

                  <div className="border-t border-gray-100 pt-10 dark:border-gray-700">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                          Activity
                        </p>
                        <h2 className="mt-1 m-0 text-lg font-semibold text-gray-900 dark:text-gray-100">
                          Account log
                        </h2>
                        <p className="mt-1 m-0 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                          Read-only history of actions on this account.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActivityLogsExpanded(!activityLogsExpanded)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        aria-expanded={activityLogsExpanded}
                        aria-label={activityLogsExpanded ? "Collapse activity log" : "Expand activity log"}
                      >
                        {activityLogsExpanded ? (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </button>
                    </div>

                    {activityLogsExpanded && (
                      <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50/40 dark:border-gray-700 dark:bg-gray-900/30">
                        {activityLoading ? (
                          <div className="flex justify-center py-14">
                            <div
                              className="h-9 w-9 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-600 dark:border-gray-600 dark:border-t-indigo-400"
                              aria-hidden
                            />
                          </div>
                        ) : activityLogs.length === 0 ? (
                          <p className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                            No activity entries yet.
                          </p>
                        ) : (
                          <>
                            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                              {activityLogs.map((log, index) => (
                                <li
                                  key={log._id || index}
                                  className="flex gap-3 px-4 py-3.5 sm:px-5"
                                >
                                  <div
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-lg shadow-sm ring-1 ring-gray-100 dark:bg-gray-800 dark:ring-gray-600"
                                    aria-hidden
                                  >
                                    {getActivityIcon(log.activityType)}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <p className="m-0 text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {log.description}
                                      </p>
                                      <span className="shrink-0 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium capitalize text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                                        {log.activityType.replace(/_/g, " ")}
                                      </span>
                                    </div>
                                    <p className="mt-1 m-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                                      {formatActivityDate(log.createdAt || log.timestamp)}
                                    </p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                            {activityPagination && activityPagination.totalPages > 1 && (
                              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 dark:border-gray-700 sm:px-5">
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  Page {activityPage} of {activityPagination.totalPages}
                                </span>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                                    disabled={activityPage === 1}
                                    className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                  >
                                    Previous
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActivityPage((p) =>
                                        Math.min(activityPagination.totalPages, p + 1)
                                      )
                                    }
                                    disabled={activityPage === activityPagination.totalPages}
                                    className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                  >
                                    Next
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === "display" && (
                <motion.div
                  key="display"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div>
                    <p className="m-0 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      Appearance
                    </p>
                    <h2 className="mt-1 m-0 text-lg font-semibold text-gray-900 dark:text-gray-100">Theme</h2>
                    <p className="mt-1 m-0 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                      Applies immediately when you pick an option; save to sync with your account.
                    </p>
                  </div>
                  <div className="grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => updateSetting("display", "theme", "light")}
                      className={`rounded-xl border px-4 py-4 text-left transition-colors ${
                        settings.display.theme === "light"
                          ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500/20 dark:border-indigo-400 dark:bg-indigo-950/40 dark:ring-indigo-400/20"
                          : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-900/40 dark:hover:border-gray-500"
                      }`}
                    >
                      <span className="text-xl" aria-hidden>
                        ☀️
                      </span>
                      <p className="mt-2 m-0 text-sm font-semibold text-gray-900 dark:text-gray-100">Light</p>
                      <p className="mt-0.5 m-0 text-xs text-gray-500 dark:text-gray-400">Bright backgrounds</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSetting("display", "theme", "dark")}
                      className={`rounded-xl border px-4 py-4 text-left transition-colors ${
                        settings.display.theme === "dark"
                          ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500/20 dark:border-indigo-400 dark:bg-indigo-950/40 dark:ring-indigo-400/20"
                          : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-600 dark:bg-gray-900/40 dark:hover:border-gray-500"
                      }`}
                    >
                      <span className="text-xl" aria-hidden>
                        🌙
                      </span>
                      <p className="mt-2 m-0 text-sm font-semibold text-gray-900 dark:text-gray-100">Dark</p>
                      <p className="mt-0.5 m-0 text-xs text-gray-500 dark:text-gray-400">Easier in low light</p>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => saveSettings("display")}
                    disabled={saving}
                    className="btn-theme-primary h-10 max-w-xs rounded-lg px-6 text-sm font-medium"
                  >
                    {saving ? "Saving…" : "Save display settings"}
                  </button>

                  <div className="pt-2">
                    <ColorThemeSection
                      role="admin"
                      initialColors={settings.colors}
                      saving={saving}
                      onSave={saveColors}
                      onReset={resetColorsOnly}
                    />
                  </div>
                </motion.div>
              )}

              {activeTab === "privacy" && (
                <motion.div
                  key="privacy"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div>
                    <p className="m-0 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      Visibility
                    </p>
                    <h2 className="mt-1 m-0 text-lg font-semibold text-gray-900 dark:text-gray-100">Privacy</h2>
                    <p className="mt-1 m-0 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                      Control how your profile appears to others in the system.
                    </p>
                  </div>
                  <div className="max-w-2xl space-y-3">
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3.5 dark:border-gray-700 dark:bg-gray-900/35">
                      <div className="min-w-0">
                        <p className="m-0 text-sm font-medium text-gray-900 dark:text-gray-100">Hide profile photo</p>
                        <p className="mt-0.5 m-0 text-xs text-gray-500 dark:text-gray-400">
                          Do not show your picture to other users
                        </p>
                      </div>
                      <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                        <input
                          type="checkbox"
                          checked={settings.privacy.hideProfilePhoto}
                          onChange={(e) =>
                            updateSetting("privacy", "hideProfilePhoto", e.target.checked)
                          }
                          className="peer sr-only"
                        />
                        <div className="relative h-6 w-11 shrink-0 rounded-full bg-gray-200 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300/80 dark:bg-gray-600 dark:peer-focus:ring-indigo-800/60" />
                      </label>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3.5 dark:border-gray-700 dark:bg-gray-900/35">
                      <div className="min-w-0">
                        <p className="m-0 text-sm font-medium text-gray-900 dark:text-gray-100">
                          Mask name in notifications
                        </p>
                        <p className="mt-0.5 m-0 text-xs text-gray-500 dark:text-gray-400">
                          Redact your name in automated system notifications
                        </p>
                      </div>
                      <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                        <input
                          type="checkbox"
                          checked={settings.privacy.maskNameInNotifications}
                          onChange={(e) =>
                            updateSetting("privacy", "maskNameInNotifications", e.target.checked)
                          }
                          className="peer sr-only"
                        />
                        <div className="relative h-6 w-11 shrink-0 rounded-full bg-gray-200 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300/80 dark:bg-gray-600 dark:peer-focus:ring-indigo-800/60" />
                      </label>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => saveSettings("privacy")}
                    disabled={saving}
                    className="btn-theme-primary h-10 max-w-xs rounded-lg px-6 text-sm font-medium"
                  >
                    {saving ? "Saving…" : "Save privacy settings"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        </main>
      </div>
    </div>
  );
}

