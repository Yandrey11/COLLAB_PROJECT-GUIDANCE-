import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import AdminSidebar from "../../components/AdminSidebar";
import PasswordStrengthMeter from "../../components/PasswordStrengthMeter.jsx";
import { applyTheme, initializeTheme } from "../../utils/themeUtils";
import { validatePassword } from "../../utils/passwordValidation";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const PROFILE_API_URL = `${BASE_URL}/api/admin/profile`;
const SETTINGS_API_URL = `${BASE_URL}/api/admin/settings`;

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

export default function AdminProfileSettingsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("account"); // account, display, privacy
  const [admin, setAdmin] = useState(null);
  const [profile, setProfile] = useState(null);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    bio: "",
  });

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // File upload state
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // Activity logs state
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityPagination, setActivityPagination] = useState(null);

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

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme();
  }, []);

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
        fetchProfile();
        fetchSettings();
      })
      .catch(() => {
        navigate("/adminlogin");
      });
  }, [navigate]);

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
        const profileData = response.data.profile;
        setProfile(profileData);
        setProfileForm({
          name: profileData.name || "",
          email: profileData.email || "",
          phoneNumber: profileData.phoneNumber || "",
          bio: profileData.bio || "",
        });
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
        params: { page: activityPage, limit: 10 },
      });

      if (response.data.success) {
        setActivityLogs(response.data.logs);
        setActivityPagination(response.data.pagination);
      }
    } catch (error) {
      console.error("Error fetching activity logs:", error);
    } finally {
      setActivityLoading(false);
    }
  };

  // Fetch settings
  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) {
        navigate("/adminlogin");
        return;
      }

      const response = await axios.get(SETTINGS_API_URL, {
        headers: { Authorization: `Bearer ${token}` },
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

  // Update profile
  const handleUpdateProfile = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem("adminToken");
      const response = await axios.put(PROFILE_API_URL, profileForm, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        await Swal.fire({
          icon: "success",
          title: "Profile Updated!",
          text: "Your profile has been updated successfully.",
          timer: 2000,
          showConfirmButton: false,
        });
        fetchProfile();
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "Failed to update profile",
      });
    } finally {
      setSaving(false);
    }
  };

  // Change password
  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Swal.fire({
        icon: "error",
        title: "Password Mismatch",
        text: "New password and confirm password do not match.",
      });
      return;
    }

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
          title: "Password Changed!",
          text: "Your password has been changed successfully.",
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
        title: "Error",
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

  // Handle profile picture upload
  const handlePictureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      Swal.fire({
        icon: "error",
        title: "Invalid File",
        text: "Please select an image file.",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      Swal.fire({
        icon: "error",
        title: "File Too Large",
        text: "Profile picture must be less than 5MB.",
      });
      return;
    }

    // Preview image
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target.result);
    };
    reader.readAsDataURL(file);

    // Upload to server
    try {
      setUploadingPicture(true);
      const token = localStorage.getItem("adminToken");
      const formData = new FormData();
      formData.append("profilePicture", file);

      const response = await axios.post(`${PROFILE_API_URL}/picture`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        await Swal.fire({
          icon: "success",
          title: "Picture Updated!",
          text: "Your profile picture has been updated successfully.",
          timer: 2000,
          showConfirmButton: false,
        });
        fetchProfile();
      }
    } catch (error) {
      console.error("Error uploading picture:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "Failed to upload picture",
      });
      setPreviewImage(null);
    } finally {
      setUploadingPicture(false);
    }
  };

  // Remove profile picture
  const handleRemovePicture = async () => {
    const result = await Swal.fire({
      title: "Remove Picture?",
      text: "Are you sure you want to remove your profile picture?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, remove it",
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      try {
        setUploadingPicture(true);
        const token = localStorage.getItem("adminToken");
        const response = await axios.delete(`${PROFILE_API_URL}/picture`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.data.success) {
          await Swal.fire({
            icon: "success",
            title: "Picture Removed!",
            text: "Your profile picture has been removed.",
            timer: 2000,
            showConfirmButton: false,
          });
          setPreviewImage(null);
          fetchProfile();
        }
      } catch (error) {
        console.error("Error removing picture:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.response?.data?.message || "Failed to remove picture",
        });
      } finally {
        setUploadingPicture(false);
      }
    }
  };

  // Save display settings
  const handleSaveDisplaySettings = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem("adminToken");
      const response = await axios.put(
        `${SETTINGS_API_URL}/display`,
        settings.display,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        // Apply theme immediately
        if (settings.display.theme) {
          applyTheme(settings.display.theme);
          localStorage.setItem("theme", settings.display.theme);
        }

        await Swal.fire({
          icon: "success",
          title: "Settings Saved!",
          text: "Display settings have been updated successfully.",
          timer: 2000,
          showConfirmButton: false,
        });
      }
    } catch (error) {
      console.error("Error saving display settings:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "Failed to save display settings",
      });
    } finally {
      setSaving(false);
    }
  };

  // Save privacy settings
  const handleSavePrivacySettings = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem("adminToken");
      const response = await axios.put(
        `${SETTINGS_API_URL}/privacy`,
        settings.privacy,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        await Swal.fire({
          icon: "success",
          title: "Settings Saved!",
          text: "Privacy settings have been updated successfully.",
          timer: 2000,
          showConfirmButton: false,
        });
      }
    } catch (error) {
      console.error("Error saving privacy settings:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "Failed to save privacy settings",
      });
    } finally {
      setSaving(false);
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

  return (
    <div
      className="admin-typography"
      style={{
        width: "100vw",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "linear-gradient(135deg, #eef2ff, #c7d2fe)",
        fontFamily: "'Montserrat', sans-serif",
        padding: "40px 16px",
        gap: 20,
      }}
    >
      <div
        style={{
          maxWidth: 1800,
          width: "100%",
        }}
      >
        <main className="min-w-0">
          {/* Header */}
          <div className="mb-8 flex items-center gap-4 min-w-0">
            <AdminSidebar variant="header" />
            <div className="min-w-0">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Profile & Settings
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage your profile information, preferences, and account settings.
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mb-6">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              {[
                { id: "account", label: "Account Settings" },
                { id: "display", label: "Display & Interface" },
                { id: "privacy", label: "Privacy" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 font-semibold text-sm transition-colors ${
                    activeTab === tab.id
                      ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6">
              <AnimatePresence mode="wait">
                {activeTab === "account" && (
                  <motion.div
                    key="account"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Profile Picture Section */}
                    <div className="mb-8">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        Profile Picture
                      </h2>
                      <div className="flex items-center gap-6">
                        <div className="relative">
                          <img
                            src={
                              previewImage ||
                              getImageUrl(profile?.profilePicture) ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(profileForm.name || "Admin")}&background=4f46e5&color=fff&size=128`
                            }
                            alt="Profile"
                            className="w-32 h-32 rounded-full object-cover border-4 border-indigo-200 dark:border-indigo-800"
                          />
                        </div>
                        <div className="flex flex-col gap-3">
                          <label className="cursor-pointer">
                            <span className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors inline-block">
                              {uploadingPicture ? "Uploading..." : "Upload Picture"}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePictureUpload}
                              className="hidden"
                              disabled={uploadingPicture}
                            />
                          </label>
                          {profile?.profilePicture && (
                            <button
                              onClick={handleRemovePicture}
                              disabled={uploadingPicture}
                              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                            >
                              Remove Picture
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Profile Information Form */}
                    <div className="mb-8">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        Profile Information
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Full Name *
                          </label>
                          <input
                            type="text"
                            value={profileForm.name}
                            onChange={(e) =>
                              setProfileForm({
                                ...profileForm,
                                name: e.target.value.replace(/[0-9]/g, ""),
                              })
                            }
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Email Address *
                          </label>
                          <input
                            type="email"
                            value={profileForm.email}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, email: e.target.value })
                            }
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            value={profileForm.phoneNumber}
                            onChange={(e) =>
                              setProfileForm({
                                ...profileForm,
                                phoneNumber: e.target.value.replace(/[^0-9+\-\s()]/g, ""),
                              })
                            }
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="+1 (555) 123-4567"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Bio
                          </label>
                          <textarea
                            value={profileForm.bio}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, bio: e.target.value })
                            }
                            rows="4"
                            maxLength={500}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="Tell us about yourself..."
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {profileForm.bio.length}/500 characters
                          </p>
                        </div>
                      </div>
                      <div className="mt-6">
                        <button
                          onClick={handleUpdateProfile}
                          disabled={saving}
                          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {saving ? "Saving..." : "Save Profile Changes"}
                        </button>
                      </div>
                    </div>

                    {/* Password Change Section */}
                    <div className="mb-8 border-t border-gray-200 dark:border-gray-700 pt-8">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        Change Password
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Current Password *
                          </label>
                          <input
                            type="password"
                            value={passwordForm.currentPassword}
                            onChange={(e) =>
                              setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                            }
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            New Password *
                          </label>
                          <input
                            type="password"
                            value={passwordForm.newPassword}
                            onChange={(e) =>
                              setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                            }
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                          />
                          <PasswordStrengthMeter
                            password={passwordForm.newPassword}
                            email={profile?.email || admin?.email || ""}
                            name={profile?.name || admin?.name || ""}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Confirm New Password *
                          </label>
                          <input
                            type="password"
                            value={passwordForm.confirmPassword}
                            onChange={(e) =>
                              setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                            }
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                          />
                        </div>
                      </div>
                      <div className="mt-6">
                        <button
                          onClick={handleChangePassword}
                          disabled={saving}
                          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {saving ? "Changing..." : "Change Password"}
                        </button>
                      </div>
                    </div>

                    {/* Activity Logs Section */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        Account Activity Logs
                      </h2>
                      {activityLoading ? (
                        <div className="text-center py-8">
                          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        </div>
                      ) : activityLogs.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                          No activity logs found.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {activityLogs.map((log, index) => (
                            <div
                              key={index}
                              className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                            >
                              <span className="text-2xl">{getActivityIcon(log.activityType)}</span>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                                    {log.description}
                                  </p>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatActivityDate(log.timestamp || log.createdAt)}
                                  </span>
                                </div>
                                {log.ipAddress && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    IP: {log.ipAddress}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {activityPagination && activityPagination.totalPages > 1 && (
                        <div className="flex justify-center items-center gap-4 mt-6">
                          <button
                            onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                            disabled={activityPage === 1}
                            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Previous
                          </button>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Page {activityPage} of {activityPagination.totalPages}
                          </span>
                          <button
                            onClick={() =>
                              setActivityPage((p) => Math.min(activityPagination.totalPages, p + 1))
                            }
                            disabled={activityPage === activityPagination.totalPages}
                            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === "display" && (
                  <motion.div
                    key="display"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
                      Display & Interface Settings
                    </h2>

                    <div className="space-y-6">
                      {/* Theme Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          Theme
                        </label>
                        <div className="flex gap-4">
                          <button
                            onClick={() =>
                              setSettings({
                                ...settings,
                                display: { ...settings.display, theme: "light" },
                              })
                            }
                            className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                              settings.display.theme === "light"
                                ? "border-indigo-600 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-400"
                            }`}
                          >
                            <div className="text-center">
                              <div className="text-2xl mb-2">☀️</div>
                              <div className="font-semibold text-gray-900 dark:text-gray-100">
                                Light
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={() =>
                              setSettings({
                                ...settings,
                                display: { ...settings.display, theme: "dark" },
                              })
                            }
                            className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                              settings.display.theme === "dark"
                                ? "border-indigo-600 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-gray-400"
                            }`}
                          >
                            <div className="text-center">
                              <div className="text-2xl mb-2">🌙</div>
                              <div className="font-semibold text-gray-900 dark:text-gray-100">
                                Dark
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>

                      <div>
                        <button
                          onClick={handleSaveDisplaySettings}
                          disabled={saving}
                          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {saving ? "Saving..." : "Save Display Settings"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "privacy" && (
                  <motion.div
                    key="privacy"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
                      Privacy Settings
                    </h2>

                    <div className="space-y-6">
                      {/* Privacy Toggles */}
                      {[
                        {
                          key: "hideProfilePhoto",
                          label: "Hide Profile Photo",
                          description: "Hide your profile picture from other users",
                        },
                        {
                          key: "maskNameInNotifications",
                          label: "Mask Name in Notifications",
                          description: "Mask your name in automatically generated system notifications",
                        },
                      ].map((item) => (
                        <div
                          key={item.key}
                          className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {item.label}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {item.description}
                            </p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.privacy[item.key]}
                              onChange={(e) =>
                                setSettings({
                                  ...settings,
                                  privacy: {
                                    ...settings.privacy,
                                    [item.key]: e.target.checked,
                                  },
                                })
                              }
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>
                      ))}

                      <div>
                        <button
                          onClick={handleSavePrivacySettings}
                          disabled={saving}
                          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {saving ? "Saving..." : "Save Privacy Settings"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}


