import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import { NotificationBadgeBadge } from "../components/NotificationBadge";
import CounselorSidebar from "../components/CounselorSidebar";
import CounselorHeaderProfile from "../components/CounselorHeaderProfile.jsx";
import { initializeTheme } from "../utils/themeUtils";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { API_BASE_URL } from "../config/apiBaseUrl";
const API_URL = `${API_BASE_URL}/api/reports`;
const BASE_URL = API_BASE_URL;
const RECORDS_API_URL = `${BASE_URL}/api/records`;
const GENERATED_REPORTS_STORAGE_KEY = "counselorGeneratedReports";

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

const saveGeneratedReportMetadata = (reportMetadata) => {
  try {
    const currentReports = JSON.parse(
      localStorage.getItem(GENERATED_REPORTS_STORAGE_KEY) || "[]"
    );
    const reports = Array.isArray(currentReports) ? currentReports : [];
    localStorage.setItem(
      GENERATED_REPORTS_STORAGE_KEY,
      JSON.stringify([reportMetadata, ...reports].slice(0, 10))
    );
  } catch (error) {
    console.warn("Unable to save generated report metadata:", error);
  }
};

const ReportsPage = () => {
  useDocumentTitle("Reports");
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [clientName, setClientName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [hasPermission, setHasPermission] = useState(true); // Default to true for backwards compatibility
  const [canGenerateReports, setCanGenerateReports] = useState(false); // Track can_generate_reports permission

  // ✅ Fetch records from backend
  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      
      if (!token) {
        console.error("No token found for fetching records");
        setError("Not authorized, no token");
        setRecords([]);
        setFilteredRecords([]);
        setLoading(false);
        return;
      }

      const res = await axios.get(API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        }
      });
      
      setRecords(res.data || []);
      setFilteredRecords(res.data || []);
    } catch (err) {
      console.error("Error fetching records:", err);
      
      // Show error message to user
      if (err.response?.status === 403) {
        const errorMessage = err.response?.data?.message || "You don't have permission to view reports. Please contact an administrator.";
        setError(errorMessage);
        setHasPermission(false); // Also update permission state to show error page
      } else if (err.response?.status === 401) {
        setError("Not authorized, no token");
        Swal.fire({
          icon: "error",
          title: "Authentication Error",
          text: "Please log in again.",
        });
        navigate("/login");
      } else {
        setError(err.response?.data?.message || "Failed to load records");
      }
      
      setRecords([]);
      setFilteredRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme();
  }, []);

  // Helper function to check and set permissions from user data
  const checkPermissions = (userData) => {
    if (!userData) {
      setCanGenerateReports(false);
      setHasPermission(false);
      return;
    }

    const userPermissions = userData.permissions || {};
    const isAdmin = userData.role === "admin" || userPermissions.is_admin === true;
    const canViewReports = isAdmin || userPermissions.can_view_reports === true;
    
    // Check if permissions field exists
    const hasPermissionField = userPermissions && Object.keys(userPermissions).length > 0;
    const hasAccess = !hasPermissionField || canViewReports;
    
    setHasPermission(hasAccess);
    
    // Set can_generate_reports permission
    // Admins always can generate reports
    // If permissions field doesn't exist, allow (backwards compatibility)
    // If permissions field exists, only allow if explicitly true
    if (isAdmin) {
      setCanGenerateReports(true);
    } else if (!hasPermissionField) {
      // Backwards compatibility: if permissions don't exist, allow
      setCanGenerateReports(true);
    } else {
      // Explicitly check if permission is true
      // Hide button if false, undefined, or not set
      const canGenerate = userPermissions.can_generate_reports === true;
      setCanGenerateReports(canGenerate);
    }
  };

  // Fetch user info from backend
  const fetchUserInfo = async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      if (!token) {
        console.warn("No token found");
        setUser(null);
        return;
      }
      
      const baseUrl = API_BASE_URL;
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
        
        // Check for error messages
        const userPermissions = userData.permissions || {};
        const hasPermissionField = userPermissions && Object.keys(userPermissions).length > 0;
        const isAdmin = userData.role === "admin" || userPermissions.is_admin === true;
        const canViewReports = isAdmin || userPermissions.can_view_reports === true;
        
        // If no permission, set error message (don't redirect - show error on page)
        if (hasPermissionField && !canViewReports) {
          setError("You don't have permission to access the Reports page. Please contact an administrator.");
        }
        
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

  // Load user from localStorage or fetch from backend
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
            // Check permissions from stored user
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

        const baseUrl = API_BASE_URL;
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

  // Fetch records after user is loaded and has permission
  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
    if (token && user && hasPermission) {
      fetchRecords();
    }
  }, [user, hasPermission]);
  
  // Show error page if no permission (after user is loaded)
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
                  Reports
                </p>
                <h1 className="mt-1.5 m-0 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                  Counseling reports
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

  // ✅ Filter records based on search criteria
  const handleFilter = () => {
    let filtered = [...records];

    if (clientName) {
      filtered = filtered.filter(record => 
        record.clientName?.toLowerCase().includes(clientName.toLowerCase())
      );
    }

    if (startDate) {
      filtered = filtered.filter(record => 
        new Date(record.date) >= new Date(startDate)
      );
    }

    if (endDate) {
      filtered = filtered.filter(record => 
        new Date(record.date) <= new Date(endDate)
      );
    }

    setFilteredRecords(filtered);
  };

  // ✅ Generate Document Tracking Number
  const generateTrackingNumber = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `DOC-${timestamp}-${random}`;
  };

  // ✅ Generate and download PDF (individual session vs. multi-record summary table)
  const handleDownloadPDF = async () => {
    const recordsToExport = selectedRecord ? [selectedRecord] : filteredRecords;
    if (recordsToExport.length === 0) return;

    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
    if (!token) {
      await Swal.fire({ icon: "warning", title: "Session required", text: "Please log in again." });
      return;
    }

    const trackingNumber = generateTrackingNumber();

    try {
      if (recordsToExport.length === 1) {
        const record = recordsToExport[0];
        const recordId = record._id ?? record.id;
        const res = await fetch(`${RECORDS_API_URL}/${recordId}/generate-pdf`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          await Swal.fire({
            icon: "error",
            title: "Could not generate individual report",
            text: err.error || res.statusText || "Request failed.",
          });
          return;
        }
        const blob = await res.blob();
        const serverName = parseFilenameFromContentDisposition(res.headers.get("Content-Disposition"));
        const fileName = serverName || `individual-counseling-report-${recordId}.pdf`;
        downloadPdfBlob(blob, fileName);
        saveGeneratedReportMetadata({
          id: `${trackingNumber}-${Date.now()}`,
          fileName,
          generatedAt: new Date().toISOString(),
          reportType: "Individual Counseling Report",
          recordCount: 1,
          clientName: record.clientName || "—",
          trackingNumber,
        });
        return;
      }

      const res = await fetch(`${RECORDS_API_URL}/summary-pdf`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recordIds: recordsToExport.map((r) => r._id ?? r.id),
          startDate: startDate || undefined,
          endDate: endDate || undefined,
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
          ? `${(selectedRecord.clientName || "record").replace(/\s+/g, "_")}_summary_${trackingNumber}.pdf`
          : `counseling_summary_${trackingNumber}_${new Date().toISOString().split("T")[0]}.pdf`);
      downloadPdfBlob(blob, fileName);
      saveGeneratedReportMetadata({
        id: `${trackingNumber}-${Date.now()}`,
        fileName,
        generatedAt: new Date().toISOString(),
        reportType: "Counseling Summary Report",
        recordCount: recordsToExport.length,
        clientName: selectedRecord?.clientName || clientName || "Multiple clients",
        trackingNumber,
      });
    } catch (e) {
      console.error(e);
      await Swal.fire({
        icon: "error",
        title: "PDF download failed",
        text: e.message || "Network error.",
      });
    }
  };

  const handleRefresh = () => {
    fetchRecords();
  };

  const formatRecordDetailDate = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
  };

  const recordStatusSurface = (status) => {
    switch (status) {
      case "Completed":
        return "border-gray-200/80 bg-green-50/90 dark:border-gray-600 dark:bg-green-950/35";
      case "Ongoing":
        return "border-gray-200/80 bg-orange-50/90 dark:border-gray-600 dark:bg-orange-950/30";
      case "Referred":
        return "border-gray-200/80 bg-purple-50/90 dark:border-gray-600 dark:bg-purple-950/35";
      default:
        return "border-gray-200/80 bg-gray-50/90 dark:border-gray-600 dark:bg-gray-900/40";
    }
  };

  const recordStatusLeftAccent = (status) => {
    switch (status) {
      case "Completed":
        return "border-l-green-500 dark:border-l-green-400";
      case "Ongoing":
        return "border-l-orange-500 dark:border-l-orange-400";
      case "Referred":
        return "border-l-purple-500 dark:border-l-purple-400";
      default:
        return "border-l-gray-400 dark:border-l-gray-500";
    }
  };

  const recordStatusText = (status) => {
    switch (status) {
      case "Completed":
        return "text-green-800 dark:text-green-300";
      case "Ongoing":
        return "text-orange-800 dark:text-orange-300";
      case "Referred":
        return "text-purple-800 dark:text-purple-300";
      default:
        return "text-gray-900 dark:text-gray-100";
    }
  };

  const detailLabelClass =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500";
  const detailReadBoxClass =
    "min-h-[100px] max-h-[220px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-gray-200 bg-gray-50/90 px-3.5 py-3 text-sm leading-relaxed text-gray-800 dark:border-gray-600 dark:bg-gray-900/45 dark:text-gray-200";

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
      const baseUrl = API_BASE_URL;

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
    <div className="min-h-screen w-full page-bg counselor-typography font-sans text-gray-900 dark:text-gray-100">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <motion.main
          className="flex w-full min-w-0 flex-col gap-8"
          variants={pageStagger}
          initial="hidden"
          animate="show"
        >
          <motion.header
            variants={pageItem}
            className="flex flex-col gap-5 border-b border-gray-200/80 pb-8 dark:border-gray-700/80 sm:flex-row sm:items-center sm:justify-between sm:gap-8 lg:pb-10"
          >
            <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-5">
              <CounselorSidebar variant="header" />
              <div className="hidden h-10 w-px shrink-0 bg-gray-200 dark:bg-gray-700 sm:block" aria-hidden />
              <div className="min-w-0">
                <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                  Reports
                </p>
                <h1 className="mt-1.5 m-0 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 sm:text-3xl">
                  Counseling reports
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  Filter sessions, review details, and export individual counseling reports or multi-session summary PDFs when allowed.
                </p>
              </div>
            </div>
            <CounselorHeaderProfile />
          </motion.header>

        <motion.section
          variants={pageItem}
          className="rounded-2xl border border-gray-200/90 bg-white dark:border-gray-700/90 dark:bg-gray-800/80"
        >
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-700/80 sm:px-6 sm:py-5">
            <h2 className="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">Filters</h2>
            <p className="mt-1 m-0 text-sm text-gray-500 dark:text-gray-400">
              Client name and optional date range
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3 lg:gap-4">
            <input
              type="text"
              placeholder="Client name…"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-600 dark:bg-gray-900/30 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-gray-500 dark:focus:ring-white/10 lg:col-span-1"
            />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-600 dark:bg-gray-900/30 dark:text-gray-100 dark:focus:ring-white/10"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-600 dark:bg-gray-900/30 dark:text-gray-100 dark:focus:ring-white/10"
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 dark:border-gray-700/80 sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:py-5">
            <button
              type="button"
              onClick={handleFilter}
              disabled={loading}
              className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white sm:w-auto"
            >
              {loading ? "Applying…" : "Apply filters"}
            </button>
            {canGenerateReports && (
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={filteredRecords.length === 0}
                title={
                  filteredRecords.length === 1
                    ? "Download an Individual Counseling Report PDF for the one matching session."
                    : "Download a Counseling Summary Report PDF (table) for all matching sessions."
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80 sm:w-auto"
              >
                {filteredRecords.length === 1 ? "Download Individual PDF" : "Download summary PDF"}
              </button>
            )}
          </div>

          {error && (
            <div className="mx-5 mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200 sm:mx-6">
              {error}
            </div>
          )}
        </motion.section>

        <motion.section
          variants={pageItem}
          className="rounded-2xl border border-gray-200/90 bg-white dark:border-gray-700/90 dark:bg-gray-800/80"
        >
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-700/80 sm:px-6 sm:py-5">
            <h2 className="m-0 text-base font-semibold text-gray-900 dark:text-gray-100">Matching records</h2>
            <p className="mt-1 m-0 text-sm text-gray-500 dark:text-gray-400">
              Open a row for full session details
            </p>
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
            <div className="-mx-1 overflow-x-auto sm:mx-0">
              <table className="w-full min-w-[640px] border-collapse text-gray-900 dark:text-gray-100">
                <thead className="border-b border-gray-200 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-900/20">
                  <tr>
                    <th className="p-3 text-left font-semibold text-xs text-gray-700 dark:text-gray-300">
                      Client Name
                    </th>
                    <th className="p-3 text-left font-semibold text-xs text-gray-700 dark:text-gray-300">
                      Date
                    </th>
                    <th className="p-3 text-center font-semibold text-xs text-gray-700 dark:text-gray-300">
                      Status
                    </th>
                    <th className="p-3 text-left font-semibold text-xs text-gray-700 dark:text-gray-300">
                      Counselor
                    </th>
                    <th className="p-3 text-center font-semibold text-xs text-gray-700 dark:text-gray-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredRecords.map((record, index) => (
                      <motion.tr
                        key={record._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <td className="p-3 font-medium text-sm text-gray-900 dark:text-gray-100">
                          {record.clientName}
                        </td>
                        <td className="p-3 text-sm text-gray-700 dark:text-gray-300">
                          {record.date
                            ? new Date(record.date).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="p-3">
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 600,
                              display: "inline-block",
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
                        </td>
                        <td className="p-3 text-sm text-gray-700 dark:text-gray-300">
                          {record.counselor}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-center">
                            <button
                              type="button"
                              onClick={() => setSelectedRecord(record)}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center">
              <p className="m-0 text-sm text-gray-500 dark:text-gray-400">
                No records match your filters.
              </p>
            </div>
          )}
          </div>
        </motion.section>
        </motion.main>
      </div>

      {/* Counselor: view individual counseling record (read-only) */}
      <AnimatePresence>
        {selectedRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-[2px]"
            onClick={() => setSelectedRecord(null)}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="shrink-0 border-b border-gray-200 bg-white/95 px-5 py-4 backdrop-blur-sm dark:border-gray-600 dark:bg-gray-800/95 sm:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Individual counseling record
                    </p>
                    <h2 className="mt-1 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                      {selectedRecord.clientName}
                    </h2>
                    <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <dt className="font-medium text-gray-600 dark:text-gray-300">Counselor</dt>
                        <dd className="truncate text-gray-900 dark:text-gray-100">
                          {selectedRecord.counselor || "—"}
                        </dd>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <dt className="font-medium text-gray-600 dark:text-gray-300">Date</dt>
                        <dd className="tabular-nums text-gray-900 dark:text-gray-100">
                          {formatRecordDetailDate(selectedRecord.date)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedRecord(null)}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                    aria-label="Close"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
                <div
                  className={`rounded-xl border border-l-4 px-4 py-4 text-center ${recordStatusSurface(
                    selectedRecord.status
                  )} ${recordStatusLeftAccent(selectedRecord.status)}`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Status
                  </p>
                  <p
                    className={`mt-2 text-lg font-semibold tracking-tight ${recordStatusText(selectedRecord.status)}`}
                  >
                    {selectedRecord.status || "—"}
                  </p>
                </div>

                <div>
                  <label className={detailLabelClass}>Notes</label>
                  <div className={detailReadBoxClass}>
                    {selectedRecord.notes?.trim() ? selectedRecord.notes : "No notes for this session."}
                  </div>
                </div>

                <div>
                  <label className={detailLabelClass}>Outcome</label>
                  <div className={detailReadBoxClass}>
                    {(selectedRecord.outcomes || selectedRecord.outcome)?.trim()
                      ? selectedRecord.outcomes || selectedRecord.outcome
                      : "No outcome recorded."}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-gray-200 bg-gray-50/80 px-5 py-4 dark:border-gray-600 dark:bg-gray-900/30 sm:px-6">
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  className="h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/80"
                >
                  Cancel
                </button>
                {canGenerateReports && (
                  <button
                    type="button"
                    onClick={handleDownloadPDF}
                    title="Download an Individual Counseling Report PDF for this session."
                    className="h-10 rounded-xl bg-gray-900 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                  >
                    Download Individual PDF
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReportsPage;
