import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import { NotificationBadgeBadge } from "../components/NotificationBadge";
import CounselorSidebar from "../components/CounselorSidebar";
import { initializeTheme } from "../utils/themeUtils";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/profile`;
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
  // Handle relative paths - ensure proper format
  let path = imagePath;
  // If it doesn't start with /uploads/, add it
  if (!path.startsWith("/uploads/") && !path.startsWith("/")) {
    path = `/uploads/profiles/${path}`;
  } else if (path.startsWith("/") && !path.startsWith("/uploads/")) {
    // If it starts with / but not /uploads/, assume it's a filename
    path = `/uploads/profiles${path}`;
  }
  // Ensure it starts with /
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  return `${BASE_URL}${path}`;
};

export default function ProfilePage() {
  useDocumentTitle("My Profile");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("profile"); // profile only

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    bio: "",
  });

  // File upload state
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme();
  }, []);

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

  // Fetch profile data
  useEffect(() => {
    fetchProfile();
  }, []);


  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await axios.get(API_URL, {
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
        
        // Set preview image - handle both full URLs and relative paths
        if (profileData.profilePicture) {
          const imageUrl = getImageUrl(profileData.profilePicture);
          console.log("📥 Profile fetch - profilePicture:", profileData.profilePicture);
          console.log("📥 Profile fetch - constructed imageUrl:", imageUrl);
          
          // Only update previewImage if it's different or not set
          if (!previewImage || previewImage !== imageUrl) {
            setPreviewImage(imageUrl);
            console.log("✅ Preview image updated from profile fetch");
          }
        } else {
          // Only clear if we don't have a preview already set
          if (previewImage && !previewImage.startsWith("data:")) {
            // Keep the preview if it's already a server URL
            console.log("ℹ️ Keeping existing preview image");
          } else {
            setPreviewImage(null);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      if (error.response?.status === 401) {
        Swal.fire({
          icon: "error",
          title: "Session Expired",
          text: "Please log in again.",
        });
        navigate("/login");
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.response?.data?.message || "Failed to load profile",
        });
      }
    } finally {
      setLoading(false);
    }
  };


  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(API_URL, profileForm, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setProfile(response.data.profile);
        await Swal.fire({
          icon: "success",
          title: "Success!",
          text: "Profile updated successfully",
          timer: 2000,
          showConfirmButton: false,
        });
        fetchProfile(); // Refresh profile data
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: error.response?.data?.message || "Failed to update profile",
      });
    }
  };


  const handleProfilePictureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      Swal.fire({
        icon: "error",
        title: "Invalid File Type",
        text: "Please upload a JPEG, PNG, GIF, or WebP image",
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      Swal.fire({
        icon: "error",
        title: "File Too Large",
        text: "Image must be less than 5MB",
      });
      return;
    }

    // Upload file
    try {
      setUploadingPicture(true);
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("profilePicture", file);

      const response = await axios.post(`${API_URL}/picture`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        // Get the image URL from the response
        const profilePictureUrl = response.data.profilePicture;
        const imageUrl = getImageUrl(profilePictureUrl);
        
        console.log("✅ Upload successful");
        console.log("✅ Response profilePicture:", profilePictureUrl);
        console.log("✅ Final imageUrl:", imageUrl);
        
        // Update profile state with the new picture URL
        setProfile((prev) => ({ 
          ...prev, 
          profilePicture: profilePictureUrl 
        }));
        
        // Set preview image to the server URL immediately
        console.log("Setting preview image to:", imageUrl);
        setPreviewImage(imageUrl);
        
        await Swal.fire({
          icon: "success",
          title: "Success!",
          text: "Profile picture uploaded successfully",
          timer: 2000,
          showConfirmButton: false,
        });
        
        // Refresh profile after upload to sync state
        // The preview image is already set above, so we just need to sync the profile state
        setTimeout(() => {
          fetchProfile();
        }, 1000);
      }
    } catch (error) {
      console.error("❌ Error uploading profile picture:", error);
      console.error("Error details:", error.response?.data);
      
      // Revert to previous profile picture if it existed
      if (profile?.profilePicture) {
        const oldImageUrl = getImageUrl(profile.profilePicture);
        setPreviewImage(oldImageUrl);
      } else {
        setPreviewImage(null);
      }
      
      Swal.fire({
        icon: "error",
        title: "Upload Failed",
        text: error.response?.data?.message || "Failed to upload profile picture",
      });
    } finally {
      setUploadingPicture(false);
      e.target.value = ""; // Reset file input
    }
  };

  const handleRemoveProfilePicture = async () => {
    const result = await Swal.fire({
      title: "Remove Profile Picture?",
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
        const token = localStorage.getItem("token");
        const response = await axios.delete(`${API_URL}/picture`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.data.success) {
          setProfile({ ...profile, profilePicture: null });
          setPreviewImage(null);
          await Swal.fire({
            icon: "success",
            title: "Removed!",
            text: "Profile picture removed successfully",
            timer: 2000,
            showConfirmButton: false,
          });
          fetchProfile();
        }
      } catch (error) {
        console.error("Error removing profile picture:", error);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.response?.data?.message || "Failed to remove profile picture",
        });
      }
    }
  };


  const handleRefresh = () => {
    fetchProfile();
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
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");

      try {
        const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
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
        <main>
          <div style={{ maxWidth: "100%", width: "100%" }}>
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm mb-6"
            >
              <div className="flex justify-between items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 m-0">
                    User Profile & Settings
                  </h1>
                  <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                    Manage your personal information and profile settings.
                  </p>
                </div>
                <button
                  onClick={() => navigate("/settings")}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                >
                  <span>⚙️</span>
                  Settings
                </button>
              </div>
            </motion.div>

            {/* Tabs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-2 shadow-sm mb-6 flex gap-2 flex-wrap"
            >
          {[
            { id: "profile", label: "Profile Information", icon: "👤" },
          ].map((tab) => (
            <motion.button
              key={tab.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                minWidth: 120,
                padding: "12px 16px",
                borderRadius: 10,
                border: "none",
                background: activeTab === tab.id ? "linear-gradient(90deg, #4f46e5, #7c3aed)" : "transparent",
                color: activeTab === tab.id ? "#fff" : undefined,
                cursor: "pointer",
                fontWeight: activeTab === tab.id ? 700 : 600,
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.2s",
              }}
              className={activeTab !== tab.id ? "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200" : ""}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </motion.button>
          ))}
            </motion.div>

            {/* Profile Information Tab */}
            <AnimatePresence mode="wait">
          {activeTab === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm"
            >
              <h2 className="text-gray-900 dark:text-gray-100" style={{ marginTop: 0, marginBottom: 24, fontSize: "1.5rem" }}>
                Profile Information
              </h2>

              {/* Profile Picture Section */}
              <div
                className="border-b border-gray-200 dark:border-gray-700"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  marginBottom: 32,
                  paddingBottom: 32,
                }}
              >
                <div
                  className="border-4 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700"
                  style={{
                    width: 150,
                    height: 150,
                    borderRadius: "50%",
                    overflow: "hidden",
                    marginBottom: 16,
                    position: "relative",
                  }}
                >
                  {previewImage ? (
                    <img
                      src={previewImage}
                      alt="Profile"
                      onError={(e) => {
                        console.error("❌ Error loading profile image");
                        console.error("❌ Failed URL:", previewImage);
                        console.error("❌ Profile picture from state:", profile?.profilePicture);
                        console.error("❌ BASE_URL:", BASE_URL);
                        
                        // Try to reload with a fresh URL from profile state
                        if (profile?.profilePicture) {
                          const retryUrl = getImageUrl(profile.profilePicture);
                          console.log("🔄 Retrying image load with URL:", retryUrl);
                          setTimeout(() => {
                            if (retryUrl && retryUrl !== previewImage) {
                              e.target.src = retryUrl + "?t=" + Date.now(); // Add timestamp to bypass cache
                              e.target.style.display = "block";
                              setPreviewImage(retryUrl);
                            } else {
                              console.error("❌ Retry URL same as failed URL");
                              e.target.style.display = "none";
                            }
                          }, 500);
                        } else {
                          console.error("❌ No profile picture in state to retry");
                          e.target.style.display = "none";
                          setPreviewImage(null);
                        }
                      }}
                      onLoad={() => {
                        console.log("✅ Profile image loaded successfully:", previewImage);
                      }}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl text-gray-400 dark:text-gray-500">
                      👤
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                  <motion.label
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 10,
                      background: "linear-gradient(90deg, #4f46e5, #7c3aed)",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 14,
                      display: "inline-block",
                    }}
                  >
                    {uploadingPicture ? "Uploading..." : "Upload Picture"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureUpload}
                      disabled={uploadingPicture}
                      style={{ display: "none" }}
                    />
                  </motion.label>
                  {profile?.profilePicture && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleRemoveProfilePicture}
                      className="px-5 py-2.5 rounded-lg border border-red-500 dark:border-red-600 bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 font-semibold text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      Remove Picture
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Profile Form */}
              <form onSubmit={handleProfileUpdate}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                    gap: 20,
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <label
                      className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300"
                    >
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      required
                      className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300"
                    >
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      required
                      className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300"
                    >
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={profileForm.phoneNumber}
                      onChange={(e) => setProfileForm({ ...profileForm, phoneNumber: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                      className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 placeholder-gray-400 dark:placeholder-gray-500"
                    />
                  </div>
                </div>
                <div className="mb-5">
                  <label
                    className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300"
                  >
                    Bio
                  </label>
                  <textarea
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                    placeholder="Tell us about yourself..."
                    rows="4"
                    maxLength={500}
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 placeholder-gray-400 dark:placeholder-gray-500 resize-y"
                  />
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {profileForm.bio.length}/500 characters
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setProfileForm({
                        name: profile?.name || "",
                        email: profile?.email || "",
                        phoneNumber: profile?.phoneNumber || "",
                        bio: profile?.bio || "",
                      });
                    }}
                    className="px-5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 10,
                      border: "none",
                      background: "linear-gradient(90deg, #4f46e5, #7c3aed)",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 14,
                      boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)",
                    }}
                  >
                    Save Changes
                  </motion.button>
                </div>
              </form>
            </motion.div>
          )}

            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

