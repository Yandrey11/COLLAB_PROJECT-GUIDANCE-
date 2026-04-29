import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import Swal from "sweetalert2";
import AdminSidebar from "../../components/AdminSidebar";
import { initializeTheme } from "../../utils/themeUtils";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/admin/profile`;
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

export default function AdminProfilePage() {
  useDocumentTitle("Admin Profile");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [admin, setAdmin] = useState(null);

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

  // Check admin authentication and load admin data
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
      })
      .catch(() => {
        navigate("/adminlogin");
      });
  }, [navigate]);

  // Fetch profile data
  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("adminToken");
      if (!token) {
        navigate("/adminlogin");
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
        navigate("/adminlogin");
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
      const token = localStorage.getItem("adminToken");
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
      const token = localStorage.getItem("adminToken");
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
          profilePicture: profilePictureUrl,
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
        const token = localStorage.getItem("adminToken");
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
    <div className="min-h-screen w-full flex flex-col items-stretch page-bg admin-typography font-sans p-3 md:p-5 gap-4">
      <div className="w-full max-w-[1800px] mx-auto flex flex-1 flex-col min-h-0 min-w-0">
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col min-h-0 w-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/80 overflow-hidden"
          >
            <div className="shrink-0 flex items-start justify-between gap-3 px-4 py-3 md:px-5 md:py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/30">
              <div className="flex items-center gap-3 min-w-0">
                <AdminSidebar variant="header" />
                <div className="min-w-0">
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 m-0 leading-tight">
                    Admin profile
                  </h1>
                  <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm m-0">
                    Photo and contact details
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/admin/settings")}
                className="shrink-0 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors inline-flex items-center gap-2"
              >
                <span className="text-base" aria-hidden>
                  ⚙️
                </span>
                Settings
              </button>
            </div>

            <div className="flex-1 flex flex-col min-h-0 p-4 md:p-6 lg:p-8">
              <div className="grid flex-1 min-h-0 grid-cols-1 gap-6 md:gap-8 lg:grid-cols-[minmax(12rem,18rem)_minmax(0,1fr)] xl:grid-cols-[minmax(14rem,22rem)_minmax(0,1fr)] lg:items-stretch">
                <div className="flex flex-col items-center lg:items-stretch pb-6 lg:pb-0 border-b border-gray-200 dark:border-gray-700 lg:border-b-0 lg:border-r lg:border-gray-200 dark:lg:border-gray-600 lg:pr-8">
                  <div className="relative w-28 h-28 sm:w-32 sm:h-32 lg:w-40 lg:h-40 rounded-full overflow-hidden border-[3px] border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 shrink-0">
                    {previewImage ? (
                      <img
                        src={previewImage}
                        alt="Profile"
                        onError={(e) => {
                          console.error("❌ Error loading profile image");
                          console.error("❌ Failed URL:", previewImage);
                          console.error("❌ Profile picture from state:", profile?.profilePicture);
                          console.error("❌ BASE_URL:", BASE_URL);

                          if (profile?.profilePicture) {
                            const retryUrl = getImageUrl(profile.profilePicture);
                            console.log("🔄 Retrying image load with URL:", retryUrl);
                            setTimeout(() => {
                              if (retryUrl && retryUrl !== previewImage) {
                                e.target.src = retryUrl + "?t=" + Date.now();
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
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl lg:text-5xl text-gray-400 dark:text-gray-500">
                        👤
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-center text-gray-500 dark:text-gray-400 lg:text-left w-full">
                    JPG, PNG, GIF or WebP · max 5MB
                  </p>
                  <div className="mt-4 flex flex-col sm:flex-row lg:flex-col gap-2 w-full max-w-xs lg:max-w-none">
                    <motion.label
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="text-center px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 text-white cursor-pointer font-semibold text-sm shadow-sm"
                    >
                      {uploadingPicture ? "Uploading…" : "Upload picture"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfilePictureUpload}
                        disabled={uploadingPicture}
                        className="hidden"
                      />
                    </motion.label>
                    {profile?.profilePicture && (
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleRemoveProfilePicture}
                        className="px-4 py-2.5 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 font-semibold text-sm hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      >
                        Remove picture
                      </motion.button>
                    )}
                  </div>
                </div>

                <form
                  onSubmit={handleProfileUpdate}
                  className="min-w-0 min-h-0 flex flex-col gap-4 lg:gap-5"
                >
                  <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 m-0 shrink-0">
                    Details
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 shrink-0">
                    <div className="min-w-0 xl:col-span-1">
                      <label className="block text-sm font-medium mb-1.5 text-gray-600 dark:text-gray-400">
                        Full name *
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
                        required
                        className="w-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/80 text-gray-900 dark:text-gray-100 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                      />
                    </div>
                    <div className="min-w-0 sm:col-span-2 xl:col-span-2">
                      <label className="block text-sm font-medium mb-1.5 text-gray-600 dark:text-gray-400">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                        required
                        className="w-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/80 text-gray-900 dark:text-gray-100 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                      />
                    </div>
                    <div className="min-w-0 sm:col-span-2 xl:col-span-3">
                      <label className="block text-sm font-medium mb-1.5 text-gray-600 dark:text-gray-400">
                        Phone
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
                        placeholder="+1 (555) 123-4567"
                        className="w-full max-w-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/80 text-gray-900 dark:text-gray-100 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 placeholder-gray-400 dark:placeholder-gray-500"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col flex-1 min-h-[12rem] lg:min-h-[14rem]">
                    <label className="block text-sm font-medium mb-1.5 text-gray-600 dark:text-gray-400 shrink-0">
                      Bio
                    </label>
                    <textarea
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                      placeholder="Role, responsibilities, or how your team can reach you…"
                      maxLength={500}
                      className="w-full flex-1 min-h-[10rem] border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/80 text-gray-900 dark:text-gray-100 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 placeholder-gray-400 dark:placeholder-gray-500 resize-y"
                    />
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 shrink-0">
                      {profileForm.bio.length}/500 characters
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-2 mt-auto border-t border-gray-100 dark:border-gray-700 shrink-0">
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
                      className="px-5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-5 py-2.5 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-indigo-600 to-violet-600 shadow-md shadow-indigo-500/20"
                    >
                      Save changes
                    </motion.button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}

