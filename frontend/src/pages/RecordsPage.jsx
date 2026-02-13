import { useEffect, useState } from "react";
import axios from "axios";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { NotificationBadgeBadge } from "../components/NotificationBadge";
import CounselorSidebar from "../components/CounselorSidebar";
import { initializeTheme } from "../utils/themeUtils";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/records`;
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

const RecordsPage = () => {
  useDocumentTitle("Counseling Records");
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
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [newRecord, setNewRecord] = useState({
    clientName: "",
    date: "",
    sessionType: "",
    status: "Ongoing",
    notes: "",
    outcomes: "",
    driveLink: "",
  });
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [driveMessage, setDriveMessage] = useState(null);
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

  const generateTrackingNumber = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    return `DOC-${timestamp}-${random}`;
  };

  const addHeaderFooter = (doc, pageNum, totalPages, trackingNumber, reportDate) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFillColor(102, 126, 234);
    doc.rect(0, 0, pageWidth, 30, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("COUNSELING RECORDS REPORT", pageWidth / 2, 12, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Document Tracking: ${trackingNumber}`, 14, 22);
    doc.text(`Date: ${reportDate}`, pageWidth - 14, 22, { align: "right" });

    doc.setFillColor(102, 126, 234);
    doc.rect(0, pageHeight - 35, pageWidth, 35, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      "CONFIDENTIAL - This document contains sensitive information and is protected under client confidentiality agreements.",
      pageWidth / 2,
      pageHeight - 28,
      { align: "center" }
    );

    doc.setFontSize(7);
    doc.text("Counseling Services Management System", 14, pageHeight - 18);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 18, { align: "center" });
    doc.text(`Tracking: ${trackingNumber}`, pageWidth - 14, pageHeight - 18, { align: "right" });

    doc.setFontSize(6);
    doc.text(
      "For inquiries, contact your system administrator. This report is generated electronically.",
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );

    doc.setTextColor(0, 0, 0);
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
          "Content-Type": "application/json"
        }
      });
      
      setRecords(res.data || []);
      
      // Fetch lock status for each record
      if (res.data && res.data.length > 0) {
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

  useEffect(() => {
    // Check for OAuth callback messages
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("error") === "drive_connection_failed") {
      setDriveMessage({ type: "error", text: "Failed to connect to Google Drive. Please try again." });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get("success") === "drive_connected") {
      setDriveMessage({ type: "success", text: "✅ Google Drive connected successfully! You can now save records with Drive links." });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Fetch records after user is loaded and has permission
  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
    if (token && user && hasPermission) {
      fetchRecords();
    } else if (user && !hasPermission) {
      // Stop loading if user doesn't have permission
      setLoading(false);
    }
  }, [user, hasPermission]);
  
  // Show error page if no permission (after user is loaded)
  // Show immediately when permission is denied
  if (user && !hasPermission) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 font-sans p-4 md:p-8 gap-6">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
          {/* Left: Sidebar */}
          <CounselorSidebar />
          
          {/* Right: Error Message */}
          <div className="w-full flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg max-w-lg w-full text-center"
            >
              <div className="text-6xl mb-4">🚫</div>
              <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">Access Denied</h1>
              <p className="text-gray-600 dark:text-gray-400 mb-6 text-lg">
                You don't have permission to access the Records page.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-8">
                Your access to this page has been restricted by an administrator. Please contact your administrator if you believe this is an error.
              </p>
              <button
                onClick={() => navigate("/dashboard")}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
              >
                Go to Dashboard
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  // Fetch lock status when edit modal opens
  useEffect(() => {
    if (selectedRecord) {
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
  useEffect(() => {
    if (driveMessage) {
      const timer = setTimeout(() => setDriveMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [driveMessage]);

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
      
      Swal.fire({
        icon: "success",
        title: "Success!",
        text: "New record created and uploaded to Google Drive successfully!",
        timer: 3000,
        showConfirmButton: false,
      });
      setNewRecord({
        clientName: "",
        date: "",
        sessionType: "",
        status: "Ongoing",
        notes: "",
        outcomes: "",
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
      
      // Update the record (lock should already be acquired when Edit was clicked)
      await axios.put(`${API_URL}/${selectedRecord._id}`, selectedRecord, {
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

  const handleDownloadPDF = () => {
    const recordsToExport = selectedRecord ? [selectedRecord] : filteredRecords;
    if (recordsToExport.length === 0) return;

    const doc = new jsPDF();
    const trackingNumber = generateTrackingNumber();
    const reportDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const reportDateTime = new Date().toLocaleString();

    let estimatedPages = Math.max(2, Math.ceil(recordsToExport.length / 2));
    if (recordsToExport.length === 1) estimatedPages = 2;

    addHeaderFooter(doc, 1, estimatedPages, trackingNumber, reportDate);
    let finalY = 50;
    const maxContentHeight = doc.internal.pageSize.getHeight() - 35 - 50;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("COUNSELING RECORDS REPORT", 105, finalY, { align: "center" });
    finalY += 15;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Report Generated: ${reportDateTime}`, 105, finalY, { align: "center" });
    finalY += 10;
    doc.text(`Document Tracking Number: ${trackingNumber}`, 105, finalY, { align: "center" });
    finalY += 10;
    doc.text(`Total Records: ${recordsToExport.length}`, 105, finalY, { align: "center" });
    finalY += 20;

    const completed = recordsToExport.filter((r) => r.status === "Completed").length;
    const ongoing = recordsToExport.filter((r) => r.status === "Ongoing").length;
    const referred = recordsToExport.filter((r) => r.status === "Referred").length;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Summary Statistics", 105, finalY, { align: "center" });
    finalY += 12;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Completed Sessions: ${completed}`, 105, finalY, { align: "center" });
    finalY += 8;
    doc.text(`Ongoing Sessions: ${ongoing}`, 105, finalY, { align: "center" });
    finalY += 8;
    doc.text(`Referred Sessions: ${referred}`, 105, finalY, { align: "center" });
    finalY += 20;

    doc.addPage();
    addHeaderFooter(doc, 2, estimatedPages, trackingNumber, reportDate);
    finalY = 50;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("DETAILED RECORDS", 105, finalY, { align: "center" });
    finalY += 15;

    const pageHeight = doc.internal.pageSize.getHeight();

    recordsToExport.forEach((record, idx) => {
      if (finalY > maxContentHeight && idx < recordsToExport.length - 1) {
        estimatedPages++;
        doc.addPage();
        addHeaderFooter(doc, doc.internal.getNumberOfPages(), estimatedPages, trackingNumber, reportDate);
        finalY = 50;
      }

      if (idx > 0) {
        doc.setDrawColor(200, 200, 200);
        doc.line(14, finalY - 5, 196, finalY - 5);
        finalY += 5;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`Record ${idx + 1}`, 14, finalY);
      finalY += 10;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");

      const details = [
        { label: "Client Name", value: record.clientName || "N/A" },
        { label: "Date", value: record.date ? new Date(record.date).toLocaleDateString() : "N/A" },
        { label: "Status", value: record.status || "N/A" },
        { label: "Counselor", value: record.counselor || "N/A" },
      ];

      details.forEach((detail) => {
        doc.setFont("helvetica", "bold");
        doc.text(`${detail.label}:`, 14, finalY);
        doc.setFont("helvetica", "normal");
        doc.text(detail.value, 64, finalY);
        finalY += 7;
      });

      doc.setFont("helvetica", "bold");
      doc.text("Notes:", 14, finalY);
      finalY += 7;
      doc.setFont("helvetica", "normal");
      const notes = record.notes || "No notes available";
      const splitNotes = doc.splitTextToSize(notes, 180);
      doc.text(splitNotes, 14, finalY);
      finalY += splitNotes.length * 5 + 5;

      doc.setFont("helvetica", "bold");
      doc.text("Outcome:", 14, finalY);
      finalY += 7;
      doc.setFont("helvetica", "normal");
      const outcome = record.outcomes || record.outcome || "No outcome recorded";
      const splitOutcome = doc.splitTextToSize(outcome, 180);
      doc.text(splitOutcome, 14, finalY);
      finalY += splitOutcome.length * 5 + 10;
    });

    if (doc.internal.getNumberOfPages() < 2) {
      doc.addPage();
      addHeaderFooter(doc, 2, 2, trackingNumber, reportDate);
      finalY = 50;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("ADDITIONAL INFORMATION", 105, finalY, { align: "center" });
      finalY += 15;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("This report contains confidential counseling session records.", 105, finalY, { align: "center" });
      finalY += 10;
      doc.text("All information is protected under client confidentiality agreements.", 105, finalY, { align: "center" });
      finalY += 15;

      doc.setFont("helvetica", "bold");
      doc.text("Report Metadata:", 14, finalY);
      finalY += 10;
      doc.setFont("helvetica", "normal");
      doc.text(`Document ID: ${trackingNumber}`, 14, finalY);
      finalY += 7;
      doc.text(`Generated On: ${reportDateTime}`, 14, finalY);
      finalY += 7;
      doc.text(`Total Records Included: ${recordsToExport.length}`, 14, finalY);
      finalY += 7;
      doc.text(`Report Type: ${selectedRecord ? "Single Record" : "Multiple Records"}`, 14, finalY);
    }

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addHeaderFooter(doc, i, totalPages, trackingNumber, reportDate);
    }

    const fileName = selectedRecord
      ? `${selectedRecord.clientName.replace(/\s+/g, "_")}_record_${trackingNumber}.pdf`
      : `counseling-records_${trackingNumber}_${new Date().toISOString().split("T")[0]}.pdf`;

    doc.save(fileName);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 font-sans p-4 md:p-8 gap-6">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        {/* Left: Overview / Navigation */}
        <CounselorSidebar />

        {/* Right: Main content */}
        <main className="w-full">
          <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
        {/* Header Card */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm"
        >
          <div className="flex flex-col gap-3">
            <div>
              <h1 className="text-gray-900 dark:text-gray-100 m-0 text-2xl md:text-3xl lg:text-4xl">
                Counseling Records
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1.5 text-sm">
                Manage and track all counseling session records, notes, and outcomes.
              </p>
            </div>
          <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600 dark:text-gray-400">Counselor:</span>
            <span
              className={`font-semibold px-3 py-1.5 rounded-lg text-sm ${
                user 
                  ? "text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/30" 
                  : "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30"
              }`}
            >
              {user?.name || user?.email || "Not logged in"}
            </span>
            </div>
          </div>
        </motion.div>

        {/* Drive Connection Message */}
        <AnimatePresence>
          {driveMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                background: driveMessage.type === "success" 
                  ? "linear-gradient(90deg, #10b981, #059669)" 
                  : "linear-gradient(90deg, #ef4444, #dc2626)",
                color: "white",
                padding: "12px 20px",
                borderRadius: 10,
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                {driveMessage.text}
              </span>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setDriveMessage(null)}
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  border: "none",
                  color: "white",
                  cursor: "pointer",
                  borderRadius: "50%",
                  width: 24,
                  height: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  fontWeight: 600,
                  padding: 0,
                }}
              >
                ×
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowForm(!showForm)}
            style={{
              background: "linear-gradient(90deg, #06b6d4, #3b82f6)",
              color: "white",
              padding: "12px 20px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 600,
              fontSize: 14,
              boxShadow: "0 4px 12px rgba(6, 182, 212, 0.3)",
            }}
          >
            <span style={{ fontSize: "18px" }}>
              {showForm ? "−" : "+"}
            </span>
            {showForm ? "Close Form" : "Create New Record"}
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
              window.location.href = `${baseUrl}/auth/drive`;
            }}
            style={{
              background: "linear-gradient(90deg, #10b981, #059669)",
              color: "white",
              padding: "12px 20px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 600,
              fontSize: 14,
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
            }}
          >
            <span style={{ fontSize: "18px" }}>☁️</span>
            Connect Google Drive
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDownloadPDF}
            style={{
              background: "linear-gradient(90deg, #4f46e5, #7c3aed)",
              color: "white",
              padding: "12px 20px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 600,
              fontSize: 14,
              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)",
            }}
          >
            📄 Download Report PDF
          </motion.button>
        </motion.div>

        {/* New Record Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0, scale: 0.95 }}
              animate={{ opacity: 1, height: "auto", scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              style={{ overflow: "hidden" }}
            >
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
                <h2 className="text-xl font-semibold mb-5 text-gray-900 dark:text-gray-100">
                  Create New Record
                </h2>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                      Client Name *
                    </label>
                    <input
                      type="text"
                      placeholder="Enter client name"
                      value={newRecord.clientName}
                      onChange={(e) =>
                        setNewRecord({
                          ...newRecord,
                          clientName: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                      Date
                    </label>
                    <input
                      type="date"
                      value={newRecord.date}
                      onChange={(e) =>
                        setNewRecord({ ...newRecord, date: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                      Session Type *
                    </label>
                    <select
                      value={newRecord.sessionType}
                      onChange={(e) =>
                        setNewRecord({
                          ...newRecord,
                          sessionType: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all cursor-pointer"
                    >
                    <option value="">Select Session Type</option>
                    <option value="Individual">Individual</option>
                    <option value="Group">Group</option>
                    <option value="Career">Career</option>
                    <option value="Academic">Academic</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                      Status
                    </label>
                    <select
                      value={newRecord.status}
                      onChange={(e) =>
                        setNewRecord({ ...newRecord, status: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all cursor-pointer"
                    >
                    <option value="Ongoing">Ongoing</option>
                    <option value="Completed">Completed</option>
                    <option value="Referred">Referred</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Session Notes
                  </label>
                  <textarea
                    placeholder="Enter session notes..."
                    value={newRecord.notes}
                    onChange={(e) =>
                      setNewRecord({ ...newRecord, notes: e.target.value })
                    }
                    rows="3"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all resize-vertical font-sans"
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Outcomes
                  </label>
                  <textarea
                    placeholder="Enter outcomes..."
                    value={newRecord.outcomes}
                    onChange={(e) =>
                      setNewRecord({ ...newRecord, outcomes: e.target.value })
                    }
                    rows="3"
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all resize-vertical font-sans"
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm"
        >
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center search-filter-container">
            <input
              type="text"
              placeholder="🔍 Search by client name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all placeholder-gray-400 dark:placeholder-gray-500"
            />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full md:w-auto border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all cursor-pointer min-w-[150px]"
            >
              <option value="">All Types</option>
              <option value="Individual">Individual</option>
              <option value="Group">Group</option>
              <option value="Career">Career</option>
              <option value="Academic">Academic</option>
            </select>
          </div>
        </motion.div>

        {/* Records Display */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm"
        >
          {loading ? (
            <div className="text-center py-12">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-12 h-12 border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full mx-auto"
              ></motion.div>
              <p className="text-gray-600 dark:text-gray-400 mt-4 text-sm">
                Loading records...
              </p>
            </div>
          ) : filteredRecords.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div
                style={{
                  display: "none",
                  overflowX: "auto",
                }}
                className="desktop-table"
              >
            <table className="w-full border-collapse text-gray-900 dark:text-gray-100">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 border-b-2 border-gray-200 dark:border-gray-600">
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
                                const lockStatus = lockStatuses[record._id];
                                const isLocked = lockStatus?.locked;
                                const isLockOwner = lockStatus?.isLockOwner;
                                const canEdit = !isLocked || isLockOwner;
                                
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
                          const lockStatus = lockStatuses[record._id];
                          const isLocked = lockStatus?.locked;
                          const isLockOwner = lockStatus?.isLockOwner;
                          const canEdit = !isLocked || isLockOwner;
                          
                          return canEdit ? (
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
                          ) : null;
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
            <div style={{ textAlign: "center", padding: "3rem 0" }}>
              <p
                style={{
                  color: "#6b7280",
                  fontSize: 14,
                  fontStyle: "italic",
                }}
              >
                No records found matching your criteria.
              </p>
            </div>
          )}
        </motion.div>

        {/* Lock/Unlock Activity Logs Card - Separate Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm"
          style={{ marginTop: 24 }}
        >
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      Lock/Unlock Activity Logs
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Recent lock and unlock activities across all records
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowLockLogsCard(!showLockLogsCard)}
                      className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
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
                      onClick={fetchAllLockLogs}
                      className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-sm cursor-pointer transition-colors flex items-center gap-2"
                      title="Refresh logs"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </button>
                  </div>
                </div>

            <AnimatePresence>
              {showLockLogsCard && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ overflow: "hidden" }}
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
        </motion.div>

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
                  background: "#fff",
                  borderRadius: 16,
                  padding: 24,
                  width: "100%",
                  maxWidth: "500px",
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
                        color: "#111827",
                      }}
                    >
                      Edit Record — {selectedRecord.clientName}
                    </h2>
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
                  const isReadOnly = isLocked && !isLockOwner;
                  
                  return (
                    <div>
                      <div style={{ marginBottom: 16 }}>
                        <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                          Session Type
                        </label>
                        <input
                          type="text"
                          value={selectedRecord.sessionType || ""}
                          onChange={(e) =>
                            setSelectedRecord({
                              ...selectedRecord,
                              sessionType: e.target.value,
                            })
                          }
                          disabled={isReadOnly}
                          className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-all ${
                            isReadOnly
                              ? "border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                              : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 cursor-text"
                          }`}
                        />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
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
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-all ${
                      isReadOnly
                        ? "border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                        : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 cursor-pointer"
                    }`}
                  >
                    <option value="Ongoing">Ongoing</option>
                    <option value="Completed">Completed</option>
                    <option value="Referred">Referred</option>
                  </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Notes
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
                    rows="3"
                    placeholder={isReadOnly ? "Record is locked. Please unlock it first." : ""}
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-all font-sans ${
                      isReadOnly
                        ? "border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed resize-none"
                        : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 cursor-text resize-vertical"
                    }`}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                    Outcomes
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
                    rows="3"
                    placeholder={isReadOnly ? "Record is locked. Please unlock it first." : ""}
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm transition-all font-sans ${
                      isReadOnly
                        ? "border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed resize-none"
                        : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 cursor-text resize-vertical"
                    }`}
                  />
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
                    {isLocked && isLockOwner && (
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
          </div>
        </main>
      </div>
    </div>
  );
};

export default RecordsPage;
