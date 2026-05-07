import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import Swal from "sweetalert2";
import CounselorSidebar from "../components/CounselorSidebar";
import { initializeTheme } from "../utils/themeUtils";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import useSingleFlight from "../hooks/useSingleFlight";
import { COUNSELOR_COLLEGES, getCounselorCollegeAvatarRingClass } from "../constants/counselorColleges";
import { API_BASE_URL } from "../config/apiBaseUrl";

const API_URL = `${API_BASE_URL}/api/profile`;
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
  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    bio: "",
    college: "",
  });

  // File upload state
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const { run: runProfileAction, isRunning: profileActionRunning } = useSingleFlight();

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
          college: profileData.college || "",
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
    await runProfileAction(async () => {
      if (profile && !profileForm.college) {
        await Swal.fire({
          icon: "error",
          title: "College required",
          text: "Please select the college you counsel for.",
        });
        return;
      }
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
    });
  };


  const handleProfilePictureUpload = async (e) => {
    if (uploadingPicture) return;
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
        const baseUrl = API_BASE_URL;
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

  const activeCollege = profileForm.college || profile?.college || "";
  const collegeAvatarRing = getCounselorCollegeAvatarRingClass(activeCollege);

  return (
    <div className="min-h-screen w-full page-bg counselor-typography font-sans text-gray-900 dark:text-gray-100">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <motion.main
          className="flex min-w-0 flex-col gap-8"
          variants={pageStagger}
          initial="hidden"
          animate="show"
        >
          <motion.header
            variants={pageItem}
            className="flex flex-col gap-4 border-b border-gray-200/80 pb-8 dark:border-gray-700/80 sm:flex-row sm:items-end sm:justify-between sm:gap-6 lg:pb-10"
          >
            <div className="flex min-w-0 items-start gap-4 sm:items-center sm:gap-5">
              <CounselorSidebar variant="header" />
              <div className="min-w-0 pt-0.5">
                <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                  Account
                </p>
                <h1 className="mt-2 m-0 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 sm:text-3xl">
                  Profile
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  Photo, college, and how students reach you.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/settings")}
              className="self-start rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80 sm:self-center"
            >
              Settings
            </button>
          </motion.header>

          <motion.div
            variants={pageItem}
            className="rounded-2xl border border-gray-200/90 bg-white dark:border-gray-700/90 dark:bg-gray-800/80"
          >
            <div className="grid min-h-0 grid-cols-1 gap-8 p-5 md:p-8 lg:grid-cols-[minmax(12rem,18rem)_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[minmax(14rem,22rem)_minmax(0,1fr)] lg:items-start">
                {/* Photo column */}
                <div className="flex flex-col items-center border-b border-gray-100 pb-8 dark:border-gray-700/80 lg:items-stretch lg:border-b-0 lg:border-r lg:pb-0 lg:pr-10">
                  <div
                    className={`relative h-28 w-28 shrink-0 overflow-hidden rounded-full bg-gray-50 dark:bg-gray-900/30 sm:h-32 sm:w-32 lg:h-40 lg:w-40 ${
                      collegeAvatarRing ?? "border-2 border-gray-200 dark:border-gray-600"
                    }`}
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
                      <div className="flex h-full w-full items-center justify-center text-gray-400 dark:text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-14 w-14 lg:h-16 lg:w-16" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="mt-4 w-full text-center text-xs text-gray-500 dark:text-gray-400 lg:text-left">
                    JPG, PNG, GIF or WebP · max 5MB
                  </p>
                  <div className="mt-4 flex w-full max-w-xs flex-col gap-2 sm:flex-row sm:justify-center lg:max-w-none lg:flex-col">
                    <label className="cursor-pointer rounded-xl bg-gray-900 px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white">
                      {uploadingPicture ? "Uploading…" : "Upload photo"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfilePictureUpload}
                        disabled={uploadingPicture}
                        className="hidden"
                      />
                    </label>
                    {profile?.profilePicture && (
                      <button
                        type="button"
                        onClick={handleRemoveProfilePicture}
                        className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-gray-600 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-950/20"
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>

                {/* Form column */}
                <form
                  onSubmit={handleProfileUpdate}
                  className="flex min-h-0 min-w-0 flex-col gap-6"
                >
                  <div>
                    <h2 className="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">Details</h2>
                    <p className="mt-1 m-0 text-sm text-gray-500 dark:text-gray-400">
                      Name, email, college, and contact info
                    </p>
                  </div>
                  <div className="grid shrink-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <div className="min-w-0 xl:col-span-1">
                      <label className="mb-1.5 block text-sm font-medium text-gray-600 dark:text-gray-400">
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
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-600 dark:bg-gray-900/30 dark:text-gray-100 dark:focus:ring-white/10"
                      />
                    </div>
                    <div className="min-w-0 sm:col-span-2 xl:col-span-2">
                      <label className="mb-1.5 block text-sm font-medium text-gray-600 dark:text-gray-400">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                        required
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-600 dark:bg-gray-900/30 dark:text-gray-100 dark:focus:ring-white/10"
                      />
                    </div>
                    <div className="min-w-0 sm:col-span-2 xl:col-span-3">
                      <label className="mb-1.5 block text-sm font-medium text-gray-600 dark:text-gray-400">
                        College *
                      </label>
                      <select
                        value={profileForm.college}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, college: e.target.value })
                        }
                        required
                        className="w-full max-w-xl rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-600 dark:bg-gray-900/30 dark:text-gray-100 dark:focus:ring-white/10"
                      >
                        <option value="">Select college</option>
                        {COUNSELOR_COLLEGES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-0 sm:col-span-2 xl:col-span-3">
                      <label className="mb-1.5 block text-sm font-medium text-gray-600 dark:text-gray-400">
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
                        className="w-full max-w-xl rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-600 dark:bg-gray-900/30 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:ring-white/10"
                      />
                    </div>
                  </div>
                  <div className="flex min-h-[12rem] flex-1 flex-col lg:min-h-[14rem]">
                    <label className="mb-1.5 block shrink-0 text-sm font-medium text-gray-600 dark:text-gray-400">
                      Bio
                    </label>
                    <textarea
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                      placeholder="Professional summary, focus areas, or how students can reach you…"
                      maxLength={500}
                      className="min-h-[10rem] w-full flex-1 resize-y rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-600 dark:bg-gray-900/30 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:ring-white/10"
                    />
                    <div className="mt-1 shrink-0 text-xs text-gray-500 dark:text-gray-400">
                      {profileForm.bio.length}/500 characters
                    </div>
                  </div>
                  <div className="mt-auto flex shrink-0 flex-wrap justify-end gap-3 border-t border-gray-100 pt-6 dark:border-gray-700/80">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileForm({
                          name: profile?.name || "",
                          email: profile?.email || "",
                          phoneNumber: profile?.phoneNumber || "",
                          bio: profile?.bio || "",
                          college: profile?.college || "",
                        });
                      }}
                      className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={profileActionRunning}
                      className="btn-theme-primary rounded-xl px-5 py-2.5 text-sm font-medium disabled:opacity-50"
                    >
                      {profileActionRunning ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                </form>
            </div>
          </motion.div>
        </motion.main>
      </div>
    </div>
  );
}

