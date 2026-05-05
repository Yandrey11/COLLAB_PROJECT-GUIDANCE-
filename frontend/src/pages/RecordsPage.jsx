import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { NotificationBadgeBadge } from "../components/NotificationBadge";
import CounselorSidebar from "../components/CounselorSidebar";
import CounselorHeaderProfile from "../components/CounselorHeaderProfile.jsx";
import { initializeTheme } from "../utils/themeUtils";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { problemsPresentedFieldValue } from "../constants/problemsPresented";
import ProblemsPresentedCheckboxes from "../components/ProblemsPresentedCheckboxes";

const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/records`;
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function parseFilenameFromContentDisposition(cd) {
  if (!cd || typeof cd !== "string") return null;
  const m = cd.match(/filename\*?=(?:UTF-8'')?["']?([^";\n]+)/i);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1].replace(/"/g, "").trim());
  } catch {
    return m[1].replace(/"/g, "").trim();
  }
}

function downloadPdfBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

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
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  if (imagePath.startsWith("data:")) {
    return imagePath;
  }
  const path = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  return `${BASE_URL}${path}`;
};

export default function RecordsPage({ archivedView = false }) {
  useDocumentTitle(archivedView ? "Archived records" : "Counseling Records");
  // Add responsive styles
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @media (min-width: 768px) {
        .desktop-table {
          display: block !important;
        }
        .mobile-cards {
          display: none !important;
        }
      }
      @media (max-width: 767px) {
        .desktop-table {
          display: none !important;
        }
        .mobile-cards {
          display: flex !important;
        }
        .search-filter-container {
          grid-template-columns: 1fr !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      // Safely remove style element if it still exists
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);
  const location = useLocation();
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [newRecord, setNewRecord] = useState({
    clientName: "",
    schoolYear: "",
    gender: "",
    course: "",
    yearLevel: "",
    section: "",
    date: "",
    sessionType: "",
    status: "Ongoing",
    problemsPresented: "",
    notes: "",
    outcomes: "",
    remarks: "",
    driveLink: "",
  });
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [hasPermission, setHasPermission] = useState(true); // Default to true for backwards compatibility
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Lock management state
  const [lockStatuses, setLockStatuses] = useState({}); // { recordId: { locked, lockedBy, canLock, canUnlock, isLockOwner } }
  const [lockingRecordId, setLockingRecordId] = useState(null);
  const [unlockingRecordId, setUnlockingRecordId] = useState(null);
  const [showLockLogs, setShowLockLogs] = useState(false);
  const [lockLogs, setLockLogs] = useState([]);
  const [selectedRecordForLogs, setSelectedRecordForLogs] = useState(null);
  const [allLockLogs, setAllLockLogs] = useState([]); // All lock/unlock logs for the card
  const [lockLogFilter, setLockLogFilter] = useState("all"); // Filter: "all", "LOCK", "UNLOCK", "UPDATE"
  const [showLockLogsCard, setShowLockLogsCard] = useState(true); // Toggle to show/hide the lock logs card
  const hasAutoSyncedDriveRef = useRef(false);

  const generateTrackingNumber = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    return `DOC-${timestamp}-${random}`;
  };

  useEffect(() => {
    initializeTheme(); // Initialize theme on page load
  }, []);

  // Helper function to check and set permissions from user data
  const checkPermissions = (userData) => {
    if (!userData) {
      setHasPermission(false);
      setLoading(false);
      return;
    }

    const userPermissions = userData.permissions || {};
    const isAdmin = userData.role === "admin" || userPermissions.is_admin === true;
    const canViewRecords = isAdmin || userPermissions.can_view_records === true;
    
    // Check if permissions field exists
    const hasPermissionField = userPermissions && Object.keys(userPermissions).length > 0;
    const hasAccess = !hasPermissionField || canViewRecords;
    
    setHasPermission(hasAccess);
    setLoading(false);
  };

  useEffect(() => {
    // Always fetch fresh user info if we have a token
    const storedToken = localStorage.getItem("token") || localStorage.getItem("authToken");
    
    if (storedToken) {
      // Fetch fresh user info from backend to ensure we have the latest data
      fetchUserInfo();
    } else {
      // No token, check if there's stored user data (fallback)
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          // Only use stored user if it has name or email
          if (parsedUser.name || parsedUser.email) {
            setUser(parsedUser);
            checkPermissions(parsedUser);
          } else {
            setUser(null);
            checkPermissions(null);
          }
        } catch (err) {
          console.error("Error parsing user data:", err);
          setUser(null);
          checkPermissions(null);
        }
      } else {
        setUser(null);
        checkPermissions(null);
      }
    }
  }, []);

  // Check permissions whenever user changes
  useEffect(() => {
    if (user) {
      checkPermissions(user);
    }
  }, [user]);

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token || !user) return;

        const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
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
  }, [user]);

  const fetchUserInfo = async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      if (!token) {
        console.warn("No token found");
        setUser(null);
        return;
      }
      
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.get(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Handle different response structures
      const userData = res.data.user || res.data;
      
      // Ensure we have name or email before setting user
      if (userData && (userData.name || userData.email)) {
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
        
        // Check permissions immediately
        checkPermissions(userData);
        
        // Also ensure token is stored consistently
        if (!localStorage.getItem("token") && localStorage.getItem("authToken")) {
          localStorage.setItem("token", localStorage.getItem("authToken"));
        }
        if (!localStorage.getItem("authToken") && localStorage.getItem("token")) {
          localStorage.setItem("authToken", localStorage.getItem("token"));
        }
      } else {
        console.warn("User data incomplete:", userData);
        setUser(null);
        checkPermissions(null);
      }
    } catch (err) {
      console.error("Error fetching user info:", err);
      // If token is invalid, clear everything
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("authToken");
        localStorage.removeItem("user");
        setUser(null);
      }
    }
  };

  const fetchRecords = async () => {
    // Don't fetch if user doesn't have permission
    if (user && !hasPermission) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      
      if (!token) {
        console.error("No token found for fetching records");
        setRecords([]);
        setLoading(false);
        return;
      }

      const res = await axios.get(API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        params: archivedView ? { archived: "true" } : {},
      });

      setRecords(res.data || []);

      // Fetch lock status for each record (archived list has no active locks)
      if (res.data && res.data.length > 0 && !archivedView) {
        res.data.forEach((record) => {
          fetchLockStatus(record._id);
        });
      }
      
      // Fetch all lock logs
      fetchAllLockLogs();
    } catch (err) {
      console.error("Error fetching records:", err);
      
      // Show error message to user
      if (err.response?.status === 403) {
        const errorMessage = err.response?.data?.message || "You don't have permission to view records. Please contact an administrator.";
        setHasPermission(false); // Update permission state to show error page
        setLoading(false);
      } else if (err.response?.status === 401) {
        Swal.fire({
          icon: "error",
          title: "Authentication Error",
          text: "Please log in again.",
        });
        navigate("/login");
      } else {
        console.error("Unexpected error:", err);
      }
      
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGoogleDrive = () => {
    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
    if (!token) {
      Swal.fire({
        icon: "warning",
        title: "Login Required",
        text: "Please log in first to connect Google Drive.",
      });
      navigate("/login");
      return;
    }

    window.location.href = `${BASE_URL}/auth/drive?token=${encodeURIComponent(token)}`;
  };

  // Fetch lock status for a record (counselor endpoint)
  const fetchLockStatus = async (recordId) => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      if (!token) return;
      
      const response = await axios.get(`${API_URL}/${recordId}/lock-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setLockStatuses((prev) => ({
        ...prev,
        [recordId]: response.data,
      }));
      
      return response.data;
    } catch (error) {
      console.error("Error fetching lock status:", error);
      // If lock status endpoint doesn't exist yet, assume unlocked
      setLockStatuses((prev) => ({
        ...prev,
        [recordId]: { locked: false, canLock: true, canUnlock: false, isLockOwner: false },
      }));
      return { locked: false, canLock: true, canUnlock: false, isLockOwner: false };
    }
  };

  // Fetch lock logs for a record
  const fetchLockLogs = async (recordId) => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      if (!token) return [];
      
      const response = await axios.get(`${API_URL}/${recordId}/lock-logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLockLogs(response.data.logs || []);
      return response.data.logs || [];
    } catch (error) {
      console.error("Error fetching lock logs:", error);
      setLockLogs([]);
      return [];
    }
  };

  // Handle viewing lock logs
  const handleViewLockLogs = async (record) => {
    setSelectedRecordForLogs(record);
    setShowLockLogs(true);
    await fetchLockLogs(record._id);
  };

  // Fetch all lock/unlock logs
  const fetchAllLockLogs = async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      if (!token) return;
      
      const params = { limit: 50 }; // Get more logs to allow filtering
      if (lockLogFilter !== "all") {
        params.action = lockLogFilter;
      }
      
      const response = await axios.get(`${API_URL}/lock-logs/all`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      console.log("All lock logs response:", response.data);
      if (response.data && response.data.success) {
        setAllLockLogs(response.data.logs || []);
      } else {
        console.warn("Unexpected response format:", response.data);
        setAllLockLogs([]);
      }
    } catch (error) {
      console.error("Error fetching all lock logs:", error);
      console.error("Error details:", error.response?.data);
      setAllLockLogs([]);
    }
  };

  // Refetch logs when filter changes
  useEffect(() => {
    if (lockLogFilter) {
      fetchAllLockLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockLogFilter]);

  // Lock a record (counselor can only lock their own records)
  const handleLockRecord = async (record) => {
    try {
      setLockingRecordId(record._id);
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      const response = await axios.post(`${API_URL}/${record._id}/lock`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Lock was successful
      if (response.data.success) {
        await fetchLockStatus(record._id);
        Swal.fire({
          icon: "success",
          title: "Record Locked",
          text: response.data.message || "Record has been locked successfully.",
          timer: 2000,
          showConfirmButton: false,
        });
        fetchRecords(); // Refresh to get updated lock info
      } else {
        Swal.fire({
          icon: "error",
          title: "Lock Failed",
          text: response.data.message || "Failed to lock record.",
        });
      }
    } catch (error) {
      console.error("Error locking record:", error);
      const errorMessage = error.response?.data?.message || "Failed to lock record.";
      Swal.fire({
        icon: "error",
        title: "Lock Failed",
        text: errorMessage,
      });
    } finally {
      setLockingRecordId(null);
    }
  };

  // Unlock a record (counselor can only unlock their own locks)
  const handleUnlockRecord = async (record) => {
    try {
      setUnlockingRecordId(record._id);
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      const response = await axios.post(`${API_URL}/${record._id}/unlock`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Unlock was successful
      if (response.data.success) {
        await fetchLockStatus(record._id);
        Swal.fire({
          icon: "success",
          title: "Record Unlocked",
          text: response.data.message || "Record has been unlocked successfully.",
          timer: 2000,
          showConfirmButton: false,
        });
        fetchRecords(); // Refresh to get updated lock info
      } else {
        Swal.fire({
          icon: "error",
          title: "Unlock Failed",
          text: response.data.message || "Failed to unlock record.",
        });
      }
    } catch (error) {
      console.error("Error unlocking record:", error);
      const errorMessage = error.response?.data?.message || "Failed to unlock record.";
      Swal.fire({
        icon: "error",
        title: "Unlock Failed",
        text: errorMessage,
      });
    } finally {
      setUnlockingRecordId(null);
    }
  };

  // Fetch records after user is loaded and has permission
  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
    if (token && user && hasPermission) {
      fetchRecords();
    } else if (user && !hasPermission) {
      // Stop loading if user doesn't have permission
      setLoading(false);
    }
  }, [user, hasPermission, archivedView]);

  // Auto-sync records without Drive link to logged-in user's Google Drive (runs once per session)
  useEffect(() => {
    if (archivedView || !user || !hasPermission || hasAutoSyncedDriveRef.current) return;
    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
    if (!token) return;

    const syncDrive = async () => {
      hasAutoSyncedDriveRef.current = true;
      try {
        const res = await axios.post(`${API_URL}/sync-drive`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.success && res.data.synced > 0) {
          fetchRecords(); // Refresh to show new Drive links
        }
      } catch {
        // Silent fail - user may not be signed in with Google
      }
    };

    syncDrive();
  }, [user, hasPermission, archivedView]);

  // Handle Google Drive OAuth redirect result
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const success = params.get("success");
    const error = params.get("error");

    if (!success && !error) return;

    if (success === "drive_connected") {
      Swal.fire({
        icon: "success",
        title: "Google Drive Connected",
        text: "Your account is now connected to Google Drive.",
        timer: 2200,
        showConfirmButton: false,
      });

      hasAutoSyncedDriveRef.current = false;
      fetchUserInfo();
      fetchRecords();
    }

    if (error) {
      Swal.fire({
        icon: "error",
        title: "Drive Connection Failed",
        text: "Unable to connect Google Drive. Please try again.",
      });
    }

    navigate(archivedView ? "/records/archive" : "/records", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, navigate, archivedView]);

  // Fetch lock status when edit modal opens (archived rows have no locks)
  useEffect(() => {
    if (selectedRecord && !selectedRecord.archivedAt) {
      fetchLockStatus(selectedRecord._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRecord]);

  // Separate effect to refresh user info if needed
  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
    if (token) {
      // If user is missing or incomplete, fetch from backend
      if (!user || (!user.name && !user.email)) {
        fetchUserInfo();
      }
    }
  }, [user]);
  
  // Auto-hide message after 5 seconds

  const handleCreateRecord = async () => {
    if (!newRecord.clientName || !newRecord.sessionType) {
      Swal.fire({
        icon: "warning",
        title: "Missing Information",
        text: "Please fill out client name and session type.",
      });
      return;
    }

    // Check if user is logged in
    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
    if (!token) {
      Swal.fire({
        icon: "warning",
        title: "Login Required",
        text: "Please log in to create records",
      });
      navigate("/login");
      return;
    }

    try {
      setLoading(true);
      
      // Ensure we have fresh user info
      let currentUser = user;
      if (!currentUser || (!currentUser.name && !currentUser.email)) {
        await fetchUserInfo();
        // Get updated user from localStorage after fetch
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          try {
            currentUser = JSON.parse(storedUser);
          } catch (e) {
            console.error("Error parsing user:", e);
          }
        }
      }
      
      // Get counselor name - must have name or email
      const counselorName = currentUser?.name || currentUser?.email;
      
      if (!counselorName) {
        Swal.fire({
          icon: "warning",
          title: "Authentication Error",
          text: "Unable to determine counselor name. Please log in again.",
        });
        navigate("/login");
        return;
      }
      
      const recordToSend = {
        ...newRecord,
        counselor: counselorName,
      };

      const res = await axios.post(API_URL, recordToSend, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Refresh records to get the updated record with driveLink
      await fetchRecords();
      
      const hasDriveLink = res.data?.driveLink;
      Swal.fire({
        icon: "success",
        title: "Success!",
        text: hasDriveLink
          ? "Record created and uploaded to your Google Drive."
          : "Record created. Sign in with Google to enable automatic Drive upload.",
        timer: 3000,
        showConfirmButton: false,
      });
      setNewRecord({
        clientName: "",
        schoolYear: "",
        gender: "",
        course: "",
        yearLevel: "",
        section: "",
        date: "",
        sessionType: "",
        status: "Ongoing",
        problemsPresented: "",
        notes: "",
        outcomes: "",
        remarks: "",
        driveLink: "",
      });
      setShowForm(false);
    } catch (err) {
      console.error("Error creating record:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to create record",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle Edit button click - Auto-lock when clicking Edit
  const handleEditClick = async (record) => {
    if (record?.archivedAt) {
      Swal.fire({
        icon: "info",
        title: "Archived",
        text: "Open Archived records to view or restore this session.",
      });
      return;
    }
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      
      // STRICT 2PL: Auto-lock record atomically when clicking Edit button
      try {
        const lockResponse = await axios.post(`${API_URL}/${record._id}/start-editing`, {}, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (!lockResponse.data.success) {
          throw new Error("Failed to acquire lock");
        }

        // Lock acquired successfully - open edit modal immediately
        setSelectedRecord(record);
        // Refresh lock status in the background (non-blocking)
        fetchLockStatus(record._id);
      } catch (lockError) {
        // Lock acquisition failed
        if (lockError.response?.status === 423) {
          const lockOwner = lockError.response?.data?.lockedBy;
          Swal.fire({
            icon: "warning",
            title: "Record Locked",
            text: `This record is locked by ${lockOwner?.userName || "another user"}. Only one user can edit at a time.`,
          });
          await fetchLockStatus(record._id);
          return;
        }
        Swal.fire({
          icon: "error",
          title: "Error",
          text: lockError.response?.data?.message || "Failed to acquire lock. Please try again.",
        });
      }
    } catch (err) {
      console.error("Error acquiring lock:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.response?.data?.message || "Failed to start editing session.",
      });
    }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");

      // Counselors must not overwrite admin-only recommendation
      const counselorUpdatePayload = { ...selectedRecord };
      delete counselorUpdatePayload.recommendation;
      
      // Update the record (lock should already be acquired when Edit was clicked)
      await axios.put(`${API_URL}/${selectedRecord._id}`, counselorUpdatePayload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      // Refresh lock status
      await fetchLockStatus(selectedRecord._id);
      
      Swal.fire({
        icon: "success",
        title: "Success",
        text: "Record updated successfully!",
        timer: 2000,
        showConfirmButton: false,
      });
      setSelectedRecord(null);
      fetchRecords();
    } catch (err) {
      console.error("Error updating record:", err);
      
      // Handle 423 Locked status
      if (err.response?.status === 423) {
        Swal.fire({
          icon: "warning",
          title: "Record Locked",
          text: err.response?.data?.message || "This record is locked by another user. You cannot edit it.",
        });
        await fetchLockStatus(selectedRecord._id);
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: err.response?.data?.message || "Failed to update record",
        });
      }
    }
  };

  const handleDelete = async (record) => {
    const result = await Swal.fire({
      title: "Delete Record?",
      html: `Are you sure you want to delete the record for <strong>${record.clientName}</strong>?<br/><br/>This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete it",
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem("token") || localStorage.getItem("authToken");
        await axios.delete(`${API_URL}/${record._id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        
        await Swal.fire({
          icon: "success",
          title: "Deleted!",
          text: "Record has been deleted successfully.",
          timer: 2000,
          showConfirmButton: false,
        });
        
        fetchRecords();
      } catch (err) {
        console.error("Error deleting record:", err);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: err.response?.data?.message || "Failed to delete record",
        });
      }
    }
  };

  const isRecordOwner = (record) => {
    if (!user) return false;
    if (user.role === "admin" || user.permissions?.is_admin) return true;
    const name = user.name || user.email;
    const email = user.email;
    return (
      record.counselor === name ||
      record.counselor === email ||
      record.auditTrail?.createdBy?.userName === name
    );
  };

  const handleArchiveRow = async (record) => {
    const result = await Swal.fire({
      title: "Archive record?",
      html: `Archive <strong>${record.clientName}</strong>? It will move to Archived records and can be restored before automatic removal (retention policy).`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#4f46e5",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, archive",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      await axios.post(
        `${API_URL}/${record._id}/archive`,
        {},
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      await Swal.fire({
        icon: "success",
        title: "Archived",
        text: "Record moved to Archived records.",
        timer: 2000,
        showConfirmButton: false,
      });
      fetchRecords();
    } catch (err) {
      console.error("Archive error:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.response?.data?.message || "Failed to archive record",
      });
    }
  };

  const handleRestoreRow = async (record) => {
    const result = await Swal.fire({
      title: "Restore record?",
      html: `Restore <strong>${record.clientName}</strong> to your active records?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#059669",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, restore",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return false;
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      await axios.post(
        `${API_URL}/${record._id}/unarchive`,
        {},
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      await Swal.fire({
        icon: "success",
        title: "Restored",
        text: "Record is back in your active list.",
        timer: 2000,
        showConfirmButton: false,
      });
      fetchRecords();
      return true;
    } catch (err) {
      console.error("Restore error:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.response?.data?.message || "Failed to restore record",
      });
      return false;
    }
  };

  const handleViewRecordReadOnly = (record) => {
    setSelectedRecord({ ...record });
  };

  const filteredRecords = records.filter((r) => {
    const matchSearch = r.clientName
      ?.toLowerCase()
      .includes(search.toLowerCase());
    const matchType = filterType ? r.sessionType === filterType : true;
    return matchSearch && matchType;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterType]);

  const handleRefresh = () => {
    fetchRecords();
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
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

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

  const handleDownloadPDF = async () => {
    const recordsToExport = selectedRecord ? [selectedRecord] : filteredRecords;
    if (recordsToExport.length === 0) return;

    const token = localStorage.getItem("authToken") || localStorage.getItem("token");
    if (!token) {
      await Swal.fire({ icon: "warning", title: "Session required", text: "Please log in again." });
      return;
    }

    const trackingNumber = generateTrackingNumber();

    try {
      if (recordsToExport.length === 1) {
        const record = recordsToExport[0];
        const recordId = record._id ?? record.id;
        const res = await fetch(`${API_URL}/${recordId}/generate-pdf`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          await Swal.fire({
            icon: "error",
            title: "Could not generate PDF",
            text: err.error || res.statusText || "Request failed.",
          });
          return;
        }
        const blob = await res.blob();
        const serverName = parseFilenameFromContentDisposition(res.headers.get("Content-Disposition"));
        const fileName =
          serverName ||
          `${(record.clientName || "record").replace(/\s+/g, "_")}_individual_${trackingNumber}.pdf`;
        downloadPdfBlob(blob, fileName);
        return;
      }

      const res = await fetch(`${API_URL}/summary-pdf`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recordIds: recordsToExport.map((r) => r._id ?? r.id),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        await Swal.fire({
          icon: "error",
          title: "Could not generate summary PDF",
          text: err.error || res.statusText || "Request failed.",
        });
        return;
      }
      const blob = await res.blob();
      const serverName = parseFilenameFromContentDisposition(res.headers.get("Content-Disposition"));
      const fileName =
        serverName ||
        (selectedRecord
          ? `${selectedRecord.clientName.replace(/\s+/g, "_")}_summary_${trackingNumber}.pdf`
          : `counseling_summary_${trackingNumber}_${new Date().toISOString().split("T")[0]}.pdf`);
      downloadPdfBlob(blob, fileName);
    } catch (e) {
      console.error(e);
      await Swal.fire({
        icon: "error",
        title: "PDF download failed",
        text: e.message || "Network error.",
      });
    }
  };

  // Show error page if no permission (after user is loaded) — must run after all hooks
  if (user && !hasPermission) {
    return (
      <div className="min-h-screen w-full page-bg counselor-typography font-sans text-gray-900 dark:text-gray-100">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <header className="mb-10 flex flex-col gap-4 border-b border-gray-200/80 pb-8 dark:border-gray-700/80 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4 sm:gap-5">
              <CounselorSidebar variant="header" />
              <div className="hidden h-10 w-px shrink-0 bg-gray-200 dark:bg-gray-700 sm:block" aria-hidden />
              <div className="min-w-0">
                <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                  Records
                </p>
                <h1 className="mt-1.5 m-0 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                  Counseling records
                </h1>
                <p className="mt-2 m-0 text-sm text-gray-500 dark:text-gray-400">Access status</p>
              </div>
            </div>
            <CounselorHeaderProfile />
          </header>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto w-full max-w-md rounded-2xl border border-gray-200/90 bg-white px-6 py-10 text-center dark:border-gray-700/90 dark:bg-gray-800/80"
          >
            <h2 className="m-0 text-lg font-semibold text-red-600 dark:text-red-400">Access denied</h2>
            <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              You don&apos;t have permission to open this page. Contact an administrator if this is unexpected.
            </p>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="mt-8 w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              Back to dashboard
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full page-bg counselor-typography font-sans text-gray-900 dark:text-gray-100">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <motion.main
          className="flex w-full min-w-0 flex-col gap-8"
          variants={pageStagger}
          initial="hidden"
          animate="show"
        >
          {/* Page intro */}
          <motion.header
            variants={pageItem}
            className="flex flex-col gap-6 border-b border-gray-200/80 pb-8 dark:border-gray-700/80 sm:flex-row sm:items-start sm:justify-between sm:gap-8 lg:pb-10"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                <CounselorSidebar variant="header" />
                <div className="hidden h-10 w-px shrink-0 bg-gray-200 dark:bg-gray-700 sm:block" aria-hidden />
                <div className="min-w-0">
                  <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                    Records
                  </p>
                  <h1 className="mt-1.5 m-0 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 sm:text-3xl">
                    {archivedView ? "Archived records" : "Counseling records"}
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    {archivedView
                      ? "Sessions you archived. Restore a record to edit it again, or download PDFs. Records past retention are removed automatically."
                      : "Session notes, outcomes, and Drive backups—organized in one list."}
                  </p>
            </div>
              </div>
            {!user?.isGoogleUser && !user?.isDriveConnected && (
                <div className="flex flex-wrap gap-2 pl-0 sm:pl-[calc(2.75rem+1.25rem)]">
                  <button
                    type="button"
                onClick={handleConnectGoogleDrive}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-900 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-900/30"
              >
                Connect Google Drive
                  </button>
                </div>
            )}
            </div>
            <CounselorHeaderProfile className="sm:pt-0.5" />
          </motion.header>

          {/* Primary actions */}
        <motion.div
            variants={pageItem}
            className="flex flex-wrap items-center gap-3"
          >
            {!archivedView && (
            <button
              type="button"
            onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              <span className="text-lg leading-none">{showForm ? "−" : "+"}</span>
              {showForm ? "Close form" : "New record"}
            </button>
            )}
            {!archivedView && (
            <button
              type="button"
            onClick={handleDownloadPDF}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
            >
              Download PDF report
            </button>
            )}
        </motion.div>

        {/* New Record Form */}
        <AnimatePresence>
          {showForm && !archivedView && (
            <motion.div
              initial={{ opacity: 0, height: 0, scale: 0.95 }}
              animate={{ opacity: 1, height: "auto", scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              style={{ overflow: "hidden" }}
            >
              <div className="rounded-2xl border border-gray-200/90 bg-white p-5 dark:border-gray-700/90 dark:bg-gray-800/80 sm:p-6">
                <h2 className="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">
                  New record
                </h2>
                <p className="mt-1.5 mb-6 text-sm text-gray-500 dark:text-gray-400">
                  Required fields are marked with *
                </p>

                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Student information
                </p>
                <div
                  className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2"
                  style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
                >
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      School year
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2025–2026"
                      value={newRecord.schoolYear}
                      onChange={(e) =>
                        setNewRecord({ ...newRecord, schoolYear: e.target.value })
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Name of the student *
                    </label>
                    <input
                      type="text"
                      placeholder="Full name"
                      value={newRecord.clientName}
                      onChange={(e) =>
                        setNewRecord({
                          ...newRecord,
                          clientName: e.target.value.replace(/[0-9]/g, ""),
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Gender
                    </label>
                    <select
                      value={newRecord.gender}
                      onChange={(e) =>
                        setNewRecord({ ...newRecord, gender: e.target.value })
                      }
                      className="w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Course
                    </label>
                    <input
                      type="text"
                      placeholder="Program or course"
                      value={newRecord.course}
                      onChange={(e) =>
                        setNewRecord({ ...newRecord, course: e.target.value })
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Year
                    </label>
                    <select
                      value={newRecord.yearLevel}
                      onChange={(e) =>
                        setNewRecord({ ...newRecord, yearLevel: e.target.value })
                      }
                      className="w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                    >
                      <option value="">Select</option>
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                      <option value="5th Year">5th Year</option>
                      <option value="Graduate">Graduate</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Section
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. A"
                      value={newRecord.section}
                      onChange={(e) =>
                        setNewRecord({ ...newRecord, section: e.target.value })
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Date
                    </label>
                    <input
                      type="date"
                      value={newRecord.date}
                      onChange={(e) =>
                        setNewRecord({ ...newRecord, date: e.target.value })
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                    />
                  </div>
                </div>

                <p className="mb-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-600 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-400">
                  <span className="font-semibold text-gray-800 dark:text-gray-200">Session no.</span> is assigned
                  automatically when you save, based on how many sessions already exist for this student name.
                </p>

                <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Session
                </p>
                <div
                  className="mb-5 grid gap-4"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  }}
                >
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Session type *
                    </label>
                    <select
                      value={newRecord.sessionType}
                      onChange={(e) =>
                        setNewRecord({
                          ...newRecord,
                          sessionType: e.target.value,
                        })
                      }
                      className="w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                    >
                      <option value="">Select session type</option>
                    <option value="Individual">Individual</option>
                    <option value="Group">Group</option>
                    <option value="Career">Career</option>
                    <option value="Academic">Academic</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Status
                    </label>
                    <select
                      value={newRecord.status}
                      onChange={(e) =>
                        setNewRecord({ ...newRecord, status: e.target.value })
                      }
                      className="w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                    >
                    <option value="Ongoing">Ongoing</option>
                    <option value="Completed">Completed</option>
                    <option value="Referred">Referred</option>
                    </select>
                  </div>
                </div>

                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  Case notes
                </p>
                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Problems presented
                  </label>
                  <ProblemsPresentedCheckboxes
                    value={newRecord.problemsPresented}
                    onChange={(next) =>
                      setNewRecord({ ...newRecord, problemsPresented: next })
                    }
                  />
                </div>

                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Session notes
                  </label>
                  <textarea
                    placeholder="Additional session notes…"
                    value={newRecord.notes}
                    onChange={(e) =>
                      setNewRecord({ ...newRecord, notes: e.target.value })
                    }
                    rows={3}
                    className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-sans text-sm text-gray-900 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                  />
                </div>

                <div className="mb-4">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Outcome of the counseling session
                  </label>
                  <textarea
                    placeholder="Summarize outcomes…"
                    value={newRecord.outcomes}
                    onChange={(e) =>
                      setNewRecord({ ...newRecord, outcomes: e.target.value })
                    }
                    rows={3}
                    className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-sans text-sm text-gray-900 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                  />
                </div>

                <div className="mb-6">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Remarks
                  </label>
                  <textarea
                    placeholder="Follow-up, referrals, or other remarks…"
                    value={newRecord.remarks}
                    onChange={(e) =>
                      setNewRecord({ ...newRecord, remarks: e.target.value })
                    }
                    rows={2}
                    className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-sans text-sm text-gray-900 transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 12,
                  }}
                >
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowForm(false)}
                    className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCreateRecord}
                    style={{
                      background: "linear-gradient(90deg, #06b6d4, #3b82f6)",
                      color: "white",
                      padding: "10px 20px",
                      borderRadius: 10,
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 14,
                      boxShadow: "0 4px 12px rgba(6, 182, 212, 0.3)",
                    }}
                  >
                    Save Record
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search and Filter */}
        <motion.section
          variants={pageItem}
          className="rounded-2xl border border-gray-200/90 bg-white dark:border-gray-700/90 dark:bg-gray-800/80"
        >
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-700/80 sm:px-6 sm:py-5">
            <h2 className="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">Find records</h2>
            <p className="mt-1 m-0 text-sm text-gray-500 dark:text-gray-400">
              Search by client or narrow by session type
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 p-5 sm:p-6 md:grid-cols-[1fr_auto] md:items-center search-filter-container">
            <input
              type="text"
              placeholder="Search by client name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-600 dark:bg-gray-900/30 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-gray-500 dark:focus:ring-white/10"
            />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full min-w-[10rem] cursor-pointer rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-600 dark:bg-gray-900/30 dark:text-gray-100 dark:focus:ring-white/10 md:w-auto"
            >
              <option value="">All session types</option>
              <option value="Individual">Individual</option>
              <option value="Group">Group</option>
              <option value="Career">Career</option>
              <option value="Academic">Academic</option>
            </select>
          </div>
        </motion.section>

        {/* Records Display */}
        <motion.section
          variants={pageItem}
          className="rounded-2xl border border-gray-200/90 bg-white dark:border-gray-700/90 dark:bg-gray-800/80"
        >
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-700/80 sm:px-6 sm:py-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
            <h2 className="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">
              {archivedView ? "Archived sessions" : "Your records"}
            </h2>
            <p className="mt-1 m-0 text-sm text-gray-500 dark:text-gray-400">
              Table on desktop, cards on smaller screens
            </p>
            </div>
            {archivedView ? (
              <button
                type="button"
                onClick={() => navigate("/records")}
                className="shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
              >
                Back to records
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/records/archive")}
                className="shrink-0 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-900 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-100 dark:hover:bg-indigo-900/30"
              >
                Archive
              </button>
            )}
          </div>
          <div className="p-4 sm:p-6">
          {loading ? (
            <div className="py-16 text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="mx-auto h-10 w-10 rounded-full border-2 border-gray-200 border-t-gray-800 dark:border-gray-600 dark:border-t-gray-200"
              />
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading records…</p>
            </div>
          ) : filteredRecords.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div
                style={{
                  display: "none",
                }}
                className="desktop-table -mx-1 overflow-x-auto sm:mx-0"
              >
            <table className="w-full min-w-[960px] border-collapse text-gray-900 dark:text-gray-100">
                  <thead className="border-b border-gray-200 bg-gray-50/80 dark:border-gray-600 dark:bg-gray-900/20">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Session #
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Client Name
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Session Type
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Counselor
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Lock Status
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Drive Link
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {paginatedRecords.map((record, index) => (
                        <motion.tr
                          key={record._id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="border-b border-gray-200 dark:border-gray-700 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        >
                          <td className="px-3 py-3 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                            #{record.sessionNumber || 1}
                          </td>
                          <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {record.clientName}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {record.date
                              ? new Date(record.date).toLocaleDateString()
                              : "-"}
                          </td>
                          <td className="px-3 py-3">
                            <span className="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold inline-block">
                              {record.sessionType}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-block ${
                              record.status === "Completed"
                                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                : record.status === "Ongoing"
                                ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                                : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                            }`}>
                              {record.status}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">
                            {record.counselor && record.counselor !== "Unknown User" && record.counselor !== "Unknown Counselor"
                              ? record.counselor
                              : user?.name || user?.email || record.counselor || "—"}
                          </td>
                          <td className="px-3 py-3">
                            {(() => {
                              const lockStatus = lockStatuses[record._id];
                              if (!lockStatus) {
                                return (
                                  <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                    Loading...
                                  </span>
                                );
                              }
                              if (lockStatus.locked) {
                                const isOwner = lockStatus.isLockOwner;
                                return (
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    isOwner
                                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                      : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                  }`}>
                                    🔒 {lockStatus.lockedBy?.userRole === "admin" ? "Admin" : lockStatus.lockedBy?.userName || "Locked"}
                                  </span>
                                );
                              }
                              return (
                                <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                  🔓 Unlocked
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-3 py-3">
                            {record.driveLink ? (
                              <a
                                href={record.driveLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline text-sm font-medium transition-colors"
                              >
                                View File
                              </a>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500 text-sm italic">
                                No file
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "12px" }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "center",
                                gap: 8,
                              }}
                            >
                              {(() => {
                                if (archivedView) {
                                  return (
                                    <>
                                      <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        type="button"
                                        onClick={() => handleViewRecordReadOnly(record)}
                                        style={{
                                          background: "#64748b",
                                          color: "white",
                                          padding: "6px 12px",
                                          borderRadius: 8,
                                          border: "none",
                                          cursor: "pointer",
                                          fontSize: 13,
                                          fontWeight: 600,
                                        }}
                                        title="View record"
                                      >
                                        View
                                      </motion.button>
                                      {isRecordOwner(record) && (
                                        <motion.button
                                          whileHover={{ scale: 1.05 }}
                                          whileTap={{ scale: 0.95 }}
                                          type="button"
                                          onClick={() => handleRestoreRow(record)}
                                          style={{
                                            background: "#059669",
                                            color: "white",
                                            padding: "6px 12px",
                                            borderRadius: 8,
                                            border: "none",
                                            cursor: "pointer",
                                            fontSize: 13,
                                            fontWeight: 600,
                                          }}
                                          title="Restore to active records"
                                        >
                                          Restore
                                        </motion.button>
                                      )}
                                    </>
                                  );
                                }
                                const lockStatus = lockStatuses[record._id];
                                const isLocked = lockStatus?.locked;
                                const isLockOwner = lockStatus?.isLockOwner;
                                const canEdit = !isLocked || isLockOwner;
                                const owner = isRecordOwner(record);
                                return (
                                  <>
                                    {canEdit && (
                                      <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleEditClick(record)}
                                        style={{
                                          background: "#4f46e5",
                                          color: "white",
                                          padding: "6px 12px",
                                          borderRadius: 8,
                                          border: "none",
                                          cursor: "pointer",
                                          fontSize: 13,
                                          fontWeight: 600,
                                        }}
                                        title="Edit record"
                                      >
                                        Edit
                                      </motion.button>
                                    )}
                                    {owner && (
                                      <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        type="button"
                                        onClick={() => handleArchiveRow(record)}
                                        style={{
                                          background: "#6366f1",
                                          color: "white",
                                          padding: "6px 12px",
                                          borderRadius: 8,
                                          border: "none",
                                          cursor: "pointer",
                                          fontSize: 13,
                                          fontWeight: 600,
                                        }}
                                        title="Archive record"
                                      >
                                        Archive
                                      </motion.button>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
                className="mobile-cards"
              >
                <AnimatePresence>
                  {paginatedRecords.map((record, index) => (
                    <motion.div
                      key={record._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4 shadow-sm"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">
                              {record.clientName}
                            </h3>
                            <span
                              style={{
                                padding: "2px 8px",
                                background: "rgba(79, 70, 229, 0.1)",
                                color: "#4f46e5",
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              Session #{record.sessionNumber || 1}
                            </span>
                          </div>
                          <p className="m-0 text-sm text-gray-600 dark:text-gray-400">
                            {record.date
                              ? new Date(record.date).toLocaleDateString()
                              : "No date"}
                          </p>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          <span className="px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold">
                            {record.sessionType}
                          </span>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: 8,
                              fontSize: 11,
                              fontWeight: 600,
                              ...(record.status === "Completed"
                                ? {
                                    background: "rgba(16, 185, 129, 0.1)",
                                    color: "#059669",
                                  }
                                : record.status === "Ongoing"
                                ? {
                                    background: "rgba(245, 158, 11, 0.1)",
                                    color: "#d97706",
                                  }
                                : {
                                    background: "rgba(168, 85, 247, 0.1)",
                                    color: "#9333ea",
                                  }),
                            }}
                          >
                            {record.status}
                          </span>
                          {(() => {
                            const lockStatus = lockStatuses[record._id];
                            if (lockStatus?.locked) {
                              const isOwner = lockStatus.isLockOwner;
                              return (
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                  isOwner
                                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                    : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                }`}>
                                  🔒 {lockStatus.lockedBy?.userRole === "admin" ? "Locked by Admin" : `Locked by ${lockStatus.lockedBy?.userName || "User"}`}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        <strong className="text-gray-900 dark:text-gray-100">Counselor:</strong>{" "}
                        {record.counselor && record.counselor !== "Unknown User" && record.counselor !== "Unknown Counselor"
                          ? record.counselor
                          : user?.name || user?.email || record.counselor || "—"}
                      </div>
                      {record.driveLink && (
                        <div className="mb-3">
                          <a
                            href={record.driveLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline text-sm font-medium transition-colors"
                          >
                            📎 View Drive File
                          </a>
                        </div>
                      )}
                      <div className="flex gap-2 mt-3">
                        {(() => {
                          if (archivedView) {
                            return (
                              <>
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  type="button"
                                  onClick={() => handleViewRecordReadOnly(record)}
                                  style={{
                                    flex: 1,
                                    background: "#64748b",
                                    color: "white",
                                    padding: "10px",
                                    borderRadius: 8,
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: 13,
                                    fontWeight: 600,
                                  }}
                                  title="View record"
                                >
                                  View
                                </motion.button>
                                {isRecordOwner(record) && (
                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    type="button"
                                    onClick={() => handleRestoreRow(record)}
                                    style={{
                                      flex: 1,
                                      background: "#059669",
                                      color: "white",
                                      padding: "10px",
                                      borderRadius: 8,
                                      border: "none",
                                      cursor: "pointer",
                                      fontSize: 13,
                                      fontWeight: 600,
                                    }}
                                    title="Restore"
                                  >
                                    Restore
                                  </motion.button>
                                )}
                              </>
                            );
                          }
                          const lockStatus = lockStatuses[record._id];
                          const isLocked = lockStatus?.locked;
                          const isLockOwner = lockStatus?.isLockOwner;
                          const canEdit = !isLocked || isLockOwner;
                          const owner = isRecordOwner(record);
                          return (
                            <>
                              {canEdit ? (
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => handleEditClick(record)}
                                  style={{
                                    flex: 1,
                                    background: "#4f46e5",
                                    color: "white",
                                    padding: "10px",
                                    borderRadius: 8,
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: 13,
                                    fontWeight: 600,
                                  }}
                                  title="Edit record"
                                >
                                  Edit
                                </motion.button>
                              ) : null}
                              {owner && (
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  type="button"
                                  onClick={() => handleArchiveRow(record)}
                                  style={{
                                    flex: 1,
                                    background: "#6366f1",
                                    color: "white",
                                    padding: "10px",
                                    borderRadius: 8,
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: 13,
                                    fontWeight: 600,
                                  }}
                                  title="Archive"
                                >
                                  Archive
                                </motion.button>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Pagination Controls */}
              {filteredRecords.length > itemsPerPage && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 24,
                    padding: "16px 0",
                    borderTop: "1px solid #e6e9ef",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      color: "#6b7280",
                    }}
                  >
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredRecords.length)} of {filteredRecords.length} records
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        border: "1px solid #e6e9ef",
                        background: currentPage === 1 ? "#f3f4f6" : "#fff",
                        cursor: currentPage === 1 ? "not-allowed" : "pointer",
                        color: currentPage === 1 ? "#9ca3af" : "#111827",
                        fontWeight: 600,
                        fontSize: 13,
                        transition: "all 0.2s",
                        opacity: currentPage === 1 ? 0.5 : 1,
                      }}
                    >
                      Previous
                    </motion.button>
                    
                    {/* Page Numbers */}
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {(() => {
                        const pages = [];
                        const maxVisible = 5;
                        
                        if (totalPages <= maxVisible) {
                          // Show all pages if 5 or fewer
                          for (let i = 1; i <= totalPages; i++) {
                            pages.push(i);
                          }
                        } else {
                          // Always show first page
                          pages.push(1);
                          
                          if (currentPage <= 3) {
                            // Near the start
                            for (let i = 2; i <= 4; i++) {
                              pages.push(i);
                            }
                            pages.push('ellipsis-end');
                            pages.push(totalPages);
                          } else if (currentPage >= totalPages - 2) {
                            // Near the end
                            pages.push('ellipsis-start');
                            for (let i = totalPages - 3; i <= totalPages; i++) {
                              pages.push(i);
                            }
                          } else {
                            // In the middle
                            pages.push('ellipsis-start');
                            for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                              pages.push(i);
                            }
                            pages.push('ellipsis-end');
                            pages.push(totalPages);
                          }
                        }
                        
                        return pages.map((page, idx) => {
                          if (page === 'ellipsis-start' || page === 'ellipsis-end') {
                            return (
                              <span
                                key={`ellipsis-${idx}`}
                                style={{
                                  padding: "8px 4px",
                                  color: "#6b7280",
                                  fontSize: 13,
                                  userSelect: "none",
                                }}
                              >
                                ...
                              </span>
                            );
                          }
                          
                          return (
                            <motion.button
                              key={page}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setCurrentPage(page)}
                              style={{
                                padding: "8px 12px",
                                borderRadius: 8,
                                border: page === currentPage ? "none" : "1px solid #e6e9ef",
                                background: page === currentPage
                                  ? "linear-gradient(90deg, #4f46e5, #7c3aed)"
                                  : "#fff",
                                cursor: "pointer",
                                color: page === currentPage ? "#fff" : "#111827",
                                fontWeight: page === currentPage ? 700 : 600,
                                fontSize: 13,
                                minWidth: 36,
                                transition: "all 0.2s",
                              }}
                            >
                              {page}
                            </motion.button>
                          );
                        });
                      })()}
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        border: "1px solid #e6e9ef",
                        background: currentPage === totalPages ? "#f3f4f6" : "#fff",
                        cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                        color: currentPage === totalPages ? "#9ca3af" : "#111827",
                        fontWeight: 600,
                        fontSize: 13,
                        transition: "all 0.2s",
                        opacity: currentPage === totalPages ? 0.5 : 1,
                      }}
                    >
                      Next
                    </motion.button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-16 text-center">
              <p className="m-0 text-sm text-gray-500 dark:text-gray-400">
                No records match your search or filters.
              </p>
            </div>
          )}
          </div>
        </motion.section>

        {/* Lock/Unlock Activity Logs Card - Separate Section */}
        <motion.section
          variants={pageItem}
          className="rounded-2xl border border-gray-200/90 bg-white dark:border-gray-700/90 dark:bg-gray-800/80"
        >
                <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-5 dark:border-gray-700/80 sm:flex-row sm:items-end sm:justify-between sm:px-6">
                  <div>
                    <h2 className="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">
                      Lock activity
                    </h2>
                    <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                      Recent lock and unlock events across records
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowLockLogsCard(!showLockLogsCard)}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
                      title={showLockLogsCard ? "Hide logs" : "Show logs"}
                    >
                      <svg 
                        className={`w-4 h-4 transition-transform ${showLockLogsCard ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      {showLockLogsCard ? "Hide" : "Show"}
                    </button>
                    <select
                      value={lockLogFilter}
                      onChange={(e) => setLockLogFilter(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 cursor-pointer"
                    >
                      <option value="all">All Actions</option>
                      <option value="LOCK">Lock Only</option>
                      <option value="UNLOCK">Unlock Only</option>
                      <option value="UPDATE">Update Only</option>
                    </select>
                    <button
                      type="button"
                      onClick={fetchAllLockLogs}
                      className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                      title="Refresh logs"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </button>
                  </div>
                </div>

            <div className="px-5 pb-5 sm:px-6">
            <AnimatePresence>
              {showLockLogsCard && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  {(() => {
                    // Filter logs based on lockLogFilter
                    const filteredLogs = lockLogFilter === "all" 
                      ? allLockLogs 
                      : allLockLogs.filter(log => log.action === lockLogFilter);
                    
                    return filteredLogs.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No lock/unlock activities found.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredLogs.map((log, index) => (
                        <div
                          key={index}
                          className="border border-gray-200 dark:border-gray-700 rounded-md p-2 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <div className="flex justify-between items-center gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
                                  log.action === "LOCK"
                                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                    : log.action === "UNLOCK"
                                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                    : log.action === "UPDATE"
                                    ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                }`}
                              >
                                {log.action}
                              </span>
                              <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                                {log.performedBy.userName} <span className="text-gray-500 dark:text-gray-400">({log.performedBy.userRole})</span>
                              </span>
                              {log.record && (
                                <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                  {log.record.clientName} - Session #{log.record.sessionNumber}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {log.timestamp ? new Date(log.timestamp).toLocaleString() : log.createdAt ? new Date(log.createdAt).toLocaleString() : "N/A"}
                            </span>
                          </div>
                          {log.reason && log.reason !== "Auto-locked when editing started" && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{log.reason}</p>
                          )}
                        </div>
                        ))}
                      </div>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>
            </div>
        </motion.section>

        {/* Edit Modal */}
        <AnimatePresence>
          {selectedRecord && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0, 0, 0, 0.5)",
                backdropFilter: "blur(4px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 50,
                padding: "16px",
              }}
              onClick={() => setSelectedRecord(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 20 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "var(--surface-color)",
                  borderRadius: 16,
                  padding: 24,
                  width: "100%",
                  maxWidth: "640px",
                  maxHeight: "90vh",
                  overflowY: "auto",
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div>
                    <h2
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: 600,
                        margin: 0,
                        color: "var(--text-primary)",
                      }}
                    >
                      {selectedRecord.archivedAt ? "View record" : "Edit Record"} —{" "}
                      {selectedRecord.clientName}
                    </h2>
                    {selectedRecord.archivedAt && (
                      <p className="m-0 mt-2 text-xs text-amber-700 dark:text-amber-300">
                        Archived — read only.
                        {selectedRecord.archivePurgeAt
                          ? ` Scheduled removal after ${new Date(selectedRecord.archivePurgeAt).toLocaleDateString()}.`
                          : ""}
                      </p>
                    )}
                    {(() => {
                      const lockStatus = lockStatuses[selectedRecord?._id];
                      if (lockStatus?.locked) {
                        const isOwner = lockStatus.isLockOwner;
                        return (
                          <div style={{ marginTop: 8 }}>
                            {isOwner ? (
                              <span style={{
                                padding: "4px 12px",
                                borderRadius: 12,
                                fontSize: 12,
                                fontWeight: 600,
                                background: "rgba(16, 185, 129, 0.1)",
                                color: "#059669",
                              }}>
                                🔒 You have locked this record
                              </span>
                            ) : (
                              <span style={{
                                padding: "4px 12px",
                                borderRadius: 12,
                                fontSize: 12,
                                fontWeight: 600,
                                background: "rgba(239, 68, 68, 0.1)",
                                color: "#dc2626",
                              }}>
                                🔒 Locked by {lockStatus.lockedBy?.userName || "another user"} - Read Only
                              </span>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <button
                    onClick={() => setSelectedRecord(null)}
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: 24,
                      cursor: "pointer",
                      color: "#718096",
                    }}
                  >
                    ×
                  </button>
                </div>

                {(() => {
                  const lockStatus = lockStatuses[selectedRecord?._id];
                  const isLocked = lockStatus?.locked;
                  const isLockOwner = lockStatus?.isLockOwner;
                  const isArchivedRecord = !!selectedRecord?.archivedAt;
                  const isReadOnly = isArchivedRecord || (isLocked && !isLockOwner);
                  
                  const ro = isReadOnly
                    ? "border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                    : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400";
                  const dateVal =
                    selectedRecord.date && !Number.isNaN(new Date(selectedRecord.date).getTime())
                      ? new Date(selectedRecord.date).toISOString().slice(0, 10)
                      : "";
                  
                  return (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        Student information
                      </p>
                      <div
                        className="mb-4 grid gap-3"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        }}
                      >
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Name of the student
                        </label>
                        <input
                          type="text"
                            value={selectedRecord.clientName || ""}
                          onChange={(e) =>
                            setSelectedRecord({
                              ...selectedRecord,
                                clientName: e.target.value.replace(/[0-9]/g, ""),
                            })
                          }
                          disabled={isReadOnly}
                            className={`w-full rounded-lg border px-3 py-2.5 text-sm ${ro}`}
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            School year
                          </label>
                          <input
                            type="text"
                            value={selectedRecord.schoolYear || ""}
                            onChange={(e) =>
                              setSelectedRecord({ ...selectedRecord, schoolYear: e.target.value })
                            }
                            disabled={isReadOnly}
                            className={`w-full rounded-lg border px-3 py-2.5 text-sm ${ro}`}
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Gender
                          </label>
                          <select
                            value={selectedRecord.gender || ""}
                            onChange={(e) =>
                              setSelectedRecord({ ...selectedRecord, gender: e.target.value })
                            }
                            disabled={isReadOnly}
                            className={`w-full rounded-lg border px-3 py-2.5 text-sm ${ro} ${isReadOnly ? "" : "cursor-pointer"}`}
                          >
                            <option value="">Select</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                            <option value="Prefer not to say">Prefer not to say</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Course
                          </label>
                          <input
                            type="text"
                            value={selectedRecord.course || ""}
                            onChange={(e) =>
                              setSelectedRecord({ ...selectedRecord, course: e.target.value })
                            }
                            disabled={isReadOnly}
                            className={`w-full rounded-lg border px-3 py-2.5 text-sm ${ro}`}
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Year
                          </label>
                          <select
                            value={selectedRecord.yearLevel || ""}
                            onChange={(e) =>
                              setSelectedRecord({ ...selectedRecord, yearLevel: e.target.value })
                            }
                            disabled={isReadOnly}
                            className={`w-full rounded-lg border px-3 py-2.5 text-sm ${ro} ${isReadOnly ? "" : "cursor-pointer"}`}
                          >
                            <option value="">Select</option>
                            <option value="1st Year">1st Year</option>
                            <option value="2nd Year">2nd Year</option>
                            <option value="3rd Year">3rd Year</option>
                            <option value="4th Year">4th Year</option>
                            <option value="5th Year">5th Year</option>
                            <option value="Graduate">Graduate</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Section
                          </label>
                          <input
                            type="text"
                            value={selectedRecord.section || ""}
                            onChange={(e) =>
                              setSelectedRecord({ ...selectedRecord, section: e.target.value })
                            }
                            disabled={isReadOnly}
                            className={`w-full rounded-lg border px-3 py-2.5 text-sm ${ro}`}
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Date
                          </label>
                          <input
                            type="date"
                            value={dateVal}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                date: e.target.value,
                              })
                            }
                            disabled={isReadOnly}
                            className={`w-full rounded-lg border px-3 py-2.5 text-sm ${ro}`}
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Session no.
                          </label>
                          <div
                            className={`w-full rounded-lg border px-3 py-2.5 text-sm ${
                              isReadOnly ? ro : "border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                            }`}
                          >
                            {selectedRecord.sessionNumber ?? "—"}
                          </div>
                        </div>
                </div>

                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        Session
                      </p>
                      <div
                        className="mb-4 grid gap-3"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        }}
                      >
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Session type
                          </label>
                          <select
                            value={selectedRecord.sessionType || ""}
                            onChange={(e) =>
                              setSelectedRecord({
                                ...selectedRecord,
                                sessionType: e.target.value,
                              })
                            }
                            disabled={isReadOnly}
                            className={`w-full rounded-lg border px-3 py-2.5 text-sm ${ro} ${isReadOnly ? "" : "cursor-pointer"}`}
                          >
                            <option value="">Select</option>
                            <option value="Individual">Individual</option>
                            <option value="Group">Group</option>
                            <option value="Career">Career</option>
                            <option value="Academic">Academic</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </label>
                  <select
                    value={selectedRecord.status}
                    onChange={(e) =>
                      setSelectedRecord({
                        ...selectedRecord,
                        status: e.target.value,
                      })
                    }
                    disabled={isReadOnly}
                            className={`w-full rounded-lg border px-3 py-2.5 text-sm ${ro} ${isReadOnly ? "" : "cursor-pointer"}`}
                  >
                    <option value="Ongoing">Ongoing</option>
                    <option value="Completed">Completed</option>
                    <option value="Referred">Referred</option>
                  </select>
                        </div>
                </div>

                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        Case notes
                      </p>
                <div style={{ marginBottom: 16 }}>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Problems presented
                        </label>
                        <ProblemsPresentedCheckboxes
                          value={problemsPresentedFieldValue(selectedRecord)}
                          onChange={(next) =>
                            setSelectedRecord({
                              ...selectedRecord,
                              problemsPresented: next,
                            })
                          }
                          disabled={isReadOnly}
                        />
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Session notes
                  </label>
                  <textarea
                    value={selectedRecord.notes || ""}
                    onChange={(e) =>
                      setSelectedRecord({
                        ...selectedRecord,
                        notes: e.target.value,
                      })
                    }
                    disabled={isReadOnly}
                          rows={3}
                    placeholder={isReadOnly ? "Record is locked. Please unlock it first." : ""}
                          className={`w-full resize-y rounded-lg border px-3 py-2.5 font-sans text-sm ${ro}`}
                  />
                </div>

                      <div style={{ marginBottom: 16 }}>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Outcome of the counseling session
                  </label>
                  <textarea
                    value={selectedRecord.outcomes || ""}
                    onChange={(e) =>
                      setSelectedRecord({
                        ...selectedRecord,
                        outcomes: e.target.value,
                      })
                    }
                    disabled={isReadOnly}
                          rows={3}
                    placeholder={isReadOnly ? "Record is locked. Please unlock it first." : ""}
                          className={`w-full resize-y rounded-lg border px-3 py-2.5 font-sans text-sm ${ro}`}
                  />
                </div>

                      <div style={{ marginBottom: 20 }}>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Remarks
                        </label>
                        <textarea
                          value={selectedRecord.remarks || ""}
                          onChange={(e) =>
                            setSelectedRecord({
                              ...selectedRecord,
                              remarks: e.target.value,
                            })
                          }
                          disabled={isReadOnly}
                          rows={2}
                          placeholder={isReadOnly ? "Record is locked." : ""}
                          className={`w-full resize-y rounded-lg border px-3 py-2.5 font-sans text-sm ${ro}`}
                        />
                      </div>

                      <div style={{ marginBottom: 20 }}>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Administrative recommendation
                        </label>
                        <div
                          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm leading-relaxed text-gray-700 dark:border-gray-600 dark:bg-gray-800/80 dark:text-gray-300"
                        >
                          {selectedRecord.recommendation?.trim()
                            ? selectedRecord.recommendation
                            : "No recommendation from administration yet."}
                        </div>
                      </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleDelete(selectedRecord)}
                    style={{
                      padding: "10px 20px",
                      borderRadius: 10,
                      border: "none",
                      background: "#ef4444",
                      cursor: "pointer",
                      color: "white",
                      fontWeight: 600,
                      fontSize: 14,
                      boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
                    }}
                  >
                    Delete Record
                  </motion.button>
                  <div style={{ display: "flex", gap: 12 }}>
                    {/* STRICT 2PL: Show unlock button only if user owns the lock (after editing) */}
                    {isLocked && isLockOwner && !isArchivedRecord && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={async () => {
                          await handleUnlockRecord(selectedRecord);
                          setSelectedRecord(null);
                        }}
                        disabled={unlockingRecordId === selectedRecord?._id}
                        style={{
                          background: unlockingRecordId === selectedRecord?._id ? "#9ca3af" : "#f59e0b",
                          color: "white",
                          padding: "10px 20px",
                          borderRadius: 10,
                          border: "none",
                          cursor: unlockingRecordId === selectedRecord?._id ? "not-allowed" : "pointer",
                          fontWeight: 600,
                          fontSize: 14,
                          boxShadow: unlockingRecordId === selectedRecord?._id ? "none" : "0 4px 12px rgba(245, 158, 11, 0.3)",
                          opacity: unlockingRecordId === selectedRecord?._id ? 0.6 : 1,
                        }}
                        title="Unlock record after finishing editing"
                      >
                        {unlockingRecordId === selectedRecord?._id ? "Unlocking..." : "🔓 Unlock"}
                      </motion.button>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedRecord(null)}
                      className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                    >
                      Cancel
                    </motion.button>
                    {isArchivedRecord && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={() => handleDownloadPDF()}
                        className="px-5 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-800 font-semibold text-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80 transition-colors cursor-pointer"
                      >
                        Download PDF
                      </motion.button>
                    )}
                    {isArchivedRecord && isRecordOwner(selectedRecord) && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={async () => {
                          const ok = await handleRestoreRow(selectedRecord);
                          if (ok) setSelectedRecord(null);
                        }}
                        style={{
                          background: "#059669",
                          color: "white",
                          padding: "10px 20px",
                          borderRadius: 10,
                          border: "none",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 14,
                          boxShadow: "0 4px 12px rgba(5, 150, 105, 0.3)",
                        }}
                      >
                        Restore
                      </motion.button>
                    )}
                    <motion.button
                      whileHover={{ scale: isReadOnly ? 1 : 1.02 }}
                      whileTap={{ scale: isReadOnly ? 1 : 0.98 }}
                      onClick={handleSave}
                      disabled={isReadOnly}
                      style={{
                        background: isReadOnly 
                          ? "#cbd5e0" 
                          : "linear-gradient(90deg, #06b6d4, #3b82f6)",
                        color: "white",
                        padding: "10px 20px",
                        borderRadius: 10,
                        border: "none",
                        cursor: isReadOnly ? "not-allowed" : "pointer",
                        fontWeight: 600,
                        fontSize: 14,
                        boxShadow: isReadOnly 
                          ? "none" 
                          : "0 4px 12px rgba(6, 182, 212, 0.3)",
                        opacity: isReadOnly ? 0.6 : 1,
                      }}
                      title={isReadOnly ? "Record is locked. Please unlock it first." : ""}
                    >
                      Save Changes
                    </motion.button>
                  </div>
                </div>
                    </div>
                  );
                })()}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lock Logs Modal */}
        <AnimatePresence>
          {showLockLogs && selectedRecordForLogs && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
                padding: "20px",
              }}
              onClick={() => setShowLockLogs(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Lock Event Logs
                  </h2>
                  <button
                    onClick={() => setShowLockLogs(false)}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl font-bold"
                  >
                    ×
                  </button>
                </div>

                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>Record:</strong> {selectedRecordForLogs.clientName} - Session {selectedRecordForLogs.sessionNumber}
                  </p>
                </div>

                {lockLogs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No lock events found.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lockLogs.map((log, index) => (
                      <div
                        key={index}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-700"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                log.action === "LOCK"
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                  : log.action === "UNLOCK"
                                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                  : log.action === "UPDATE"
                                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                                  : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                              }`}
                            >
                              {log.action}
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {log.performedBy.userName} ({log.performedBy.userRole})
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(log.timestamp || log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {log.reason && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{log.reason}</p>
                        )}
                        {log.metadata && log.metadata.changedFields && log.metadata.changedFields.length > 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Changed fields: {log.metadata.changedFields.join(", ")}
                          </p>
                        )}
                        {log.lockOwner && log.lockOwner.userName !== log.performedBy.userName && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            Lock owner: {log.lockOwner.userName}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        </motion.main>
      </div>
    </div>
  );
}
