import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";
import { NotificationBadgeBadge } from "../components/NotificationBadge";
import CounselorSidebar from "../components/CounselorSidebar";
import { initializeTheme } from "../utils/themeUtils";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/reports`;
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
      <div className="min-h-screen w-full flex flex-col items-center page-bg font-sans p-4 md:p-8 gap-6">
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
                You don't have permission to access the Reports page.
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

  // ✅ Add header and footer to each page
  const addHeaderFooter = (doc, pageNum, totalPages, trackingNumber, reportDate) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Header
    doc.setFillColor(102, 126, 234); // #667eea
    doc.rect(0, 0, pageWidth, 30, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("COUNSELING RECORDS REPORT", pageWidth / 2, 12, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Document Tracking: ${trackingNumber}`, 14, 22);
    doc.text(`Date: ${reportDate}`, pageWidth - 14, 22, { align: 'right' });

    // Footer with comprehensive information
    doc.setFillColor(102, 126, 234);
    doc.rect(0, pageHeight - 35, pageWidth, 35, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    
    // Footer line 1: Confidentiality notice
    doc.text("CONFIDENTIAL - This document contains sensitive information and is protected under client confidentiality agreements.", 
      pageWidth / 2, pageHeight - 28, { align: 'center' });
    
    // Footer line 2: Organization info and page number
    doc.setFontSize(7);
    doc.text("Counseling Services Management System", 14, pageHeight - 18);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 18, { align: 'center' });
    doc.text(`Tracking: ${trackingNumber}`, pageWidth - 14, pageHeight - 18, { align: 'right' });
    
    // Footer line 3: Contact and disclaimer
    doc.setFontSize(6);
    doc.text("For inquiries, contact your system administrator. This report is generated electronically.", 
      pageWidth / 2, pageHeight - 10, { align: 'center' });
    
    // Reset text color for content
    doc.setTextColor(0, 0, 0);
  };

  // ✅ Generate and download PDF
  const handleDownloadPDF = () => {
    const recordsToExport = selectedRecord ? [selectedRecord] : filteredRecords;
    if (recordsToExport.length === 0) return;

    const doc = new jsPDF();
    const trackingNumber = generateTrackingNumber();
    const reportDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const reportDateTime = new Date().toLocaleString();

    // Calculate total pages needed (ensure at least 2 pages)
    let estimatedPages = Math.max(2, Math.ceil(recordsToExport.length / 2));
    if (recordsToExport.length === 1) estimatedPages = 2; // Force at least 2 pages for single record

    // Page 1: Cover/Summary Page
    addHeaderFooter(doc, 1, estimatedPages, trackingNumber, reportDate);
    
    let finalY = 50; // Start below header (30px header)
    const maxContentHeight = doc.internal.pageSize.getHeight() - 35 - 50; // Account for footer (35px) and bottom margin

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("COUNSELING RECORDS REPORT", 105, finalY, { align: 'center' });
    finalY += 15;

    // Report Information
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Report Generated: ${reportDateTime}`, 105, finalY, { align: 'center' });
    finalY += 10;
    doc.text(`Document Tracking Number: ${trackingNumber}`, 105, finalY, { align: 'center' });
    finalY += 10;
    doc.text(`Total Records: ${recordsToExport.length}`, 105, finalY, { align: 'center' });
    finalY += 20;

    // Summary Statistics
    const completed = recordsToExport.filter(r => r.status === "Completed").length;
    const ongoing = recordsToExport.filter(r => r.status === "Ongoing").length;
    const referred = recordsToExport.filter(r => r.status === "Referred").length;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Summary Statistics", 105, finalY, { align: 'center' });
    finalY += 12;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Completed Sessions: ${completed}`, 105, finalY, { align: 'center' });
    finalY += 8;
    doc.text(`Ongoing Sessions: ${ongoing}`, 105, finalY, { align: 'center' });
    finalY += 8;
    doc.text(`Referred Sessions: ${referred}`, 105, finalY, { align: 'center' });
    finalY += 20;

    // Date Range (if applicable)
    if (startDate || endDate) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Date Range:", 105, finalY, { align: 'center' });
      finalY += 8;
      doc.setFont("helvetica", "normal");
      const dateRange = `${startDate || 'N/A'} to ${endDate || 'N/A'}`;
      doc.text(dateRange, 105, finalY, { align: 'center' });
    }

    // Add second page for records
    doc.addPage();
    addHeaderFooter(doc, 2, estimatedPages, trackingNumber, reportDate);
    finalY = 50;

    // Records Details
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("DETAILED RECORDS", 105, finalY, { align: 'center' });
    finalY += 15;

    recordsToExport.forEach((record, idx) => {
      // Check if we need a new page (accounting for footer height)
      if (finalY > maxContentHeight && idx < recordsToExport.length - 1) {
        estimatedPages++;
        doc.addPage();
        addHeaderFooter(doc, doc.internal.getNumberOfPages(), estimatedPages, trackingNumber, reportDate);
        finalY = 50;
      }

      // Record separator
      if (idx > 0) {
        doc.setDrawColor(200, 200, 200);
        doc.line(14, finalY - 5, 196, finalY - 5);
        finalY += 5;
      }

      // Record header
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`Record ${idx + 1}`, 14, finalY);
      finalY += 10;

      // Record details
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      
      const details = [
        { label: "Client Name", value: record.clientName || "N/A" },
        { label: "Date", value: new Date(record.date).toLocaleDateString() },
        { label: "Status", value: record.status || "N/A" },
        { label: "Counselor", value: record.counselor || "N/A" },
      ];

      details.forEach(detail => {
        doc.setFont("helvetica", "bold");
        doc.text(`${detail.label}:`, 14, finalY);
        doc.setFont("helvetica", "normal");
        doc.text(detail.value, 14 + 50, finalY);
        finalY += 7;
      });

      // Notes (with word wrap)
      doc.setFont("helvetica", "bold");
      doc.text("Notes:", 14, finalY);
      finalY += 7;
      doc.setFont("helvetica", "normal");
      const notes = record.notes || "No notes available";
      const splitNotes = doc.splitTextToSize(notes, 180);
      doc.text(splitNotes, 14, finalY);
      finalY += splitNotes.length * 5 + 5;

      // Outcome (with word wrap)
      doc.setFont("helvetica", "bold");
      doc.text("Outcome:", 14, finalY);
      finalY += 7;
      doc.setFont("helvetica", "normal");
      const outcome = record.outcomes || record.outcome || "No outcome recorded";
      const splitOutcome = doc.splitTextToSize(outcome, 180);
      doc.text(splitOutcome, 14, finalY);
      finalY += splitOutcome.length * 5 + 10;
    });

    // If we only have one page of records, add additional content to ensure 2 pages
    if (doc.internal.getNumberOfPages() < 2) {
      doc.addPage();
      addHeaderFooter(doc, 2, 2, trackingNumber, reportDate);
      finalY = 50;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("ADDITIONAL INFORMATION", 105, finalY, { align: 'center' });
      finalY += 15;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("This report contains confidential counseling session records.", 105, finalY, { align: 'center' });
      finalY += 10;
      doc.text("All information is protected under client confidentiality agreements.", 105, finalY, { align: 'center' });
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
      doc.text(`Report Type: ${selectedRecord ? 'Single Record' : 'Multiple Records'}`, 14, finalY);
    }

    // Update all page numbers with correct total
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addHeaderFooter(doc, i, totalPages, trackingNumber, reportDate);
    }

    const fileName = selectedRecord
      ? `${selectedRecord.clientName.replace(/\s+/g, '_')}_record_${trackingNumber}.pdf`
      : `counseling-records_${trackingNumber}_${new Date().toISOString().split('T')[0]}.pdf`;

    doc.save(fileName);
  };

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

  return (
    <div className="min-h-screen w-full flex flex-col items-center page-bg font-sans p-4 md:p-8 gap-6">
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
            <div>
              <h1 className="text-gray-900 dark:text-gray-100" style={{ margin: 0, fontSize: "clamp(1.5rem, 4vw, 2rem)" }}>
                Counseling Reports
              </h1>
              <p className="text-gray-500 dark:text-gray-400" style={{ marginTop: 6, fontSize: 14 }}>
                Generate and review comprehensive progress reports for counseling sessions.
              </p>
            </div>
        </motion.div>
        {/* Filter Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <input
              type="text"
              placeholder="🔍 Search by client name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all placeholder-gray-400 dark:placeholder-gray-500"
            />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all"
            />
          </div>
          
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleFilter}
              disabled={loading}
              style={{
                background: "linear-gradient(90deg, #06b6d4, #3b82f6)",
                color: "white",
                padding: "12px 20px",
                borderRadius: 10,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: 14,
                boxShadow: "0 4px 12px rgba(6, 182, 212, 0.3)",
                opacity: loading ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {loading ? "⏳ Loading..." : "📊 Filter Records"}
            </motion.button>
            {canGenerateReports && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDownloadPDF}
                disabled={filteredRecords.length === 0}
                style={{
                  background: "linear-gradient(90deg, #10b981, #059669)",
                  color: "white",
                  padding: "12px 20px",
                  borderRadius: 10,
                  border: "none",
                  cursor: filteredRecords.length === 0 ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                  opacity: filteredRecords.length === 0 ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                📥 Download PDF
              </motion.button>
            )}
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginTop: 20,
                padding: 12,
                background: "#fee",
                color: "#c33",
                borderRadius: 10,
                textAlign: "center",
                fontWeight: 500,
                fontSize: 14,
              }}
            >
              ❌ {error}
            </motion.div>
          )}
        </motion.div>

        {/* Records Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm"
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem 0" }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                style={{
                  width: "3rem",
                  height: "3rem",
                  border: "4px solid #4f46e5",
                  borderTopColor: "transparent",
                  borderRadius: "9999px",
                  margin: "0 auto",
                }}
              ></motion.div>
              <p style={{ color: "#6b7280", marginTop: "1rem", fontSize: 14 }}>
                Loading records...
              </p>
            </div>
          ) : filteredRecords.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table className="w-full border-collapse text-gray-900 dark:text-gray-100">
                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b-2 border-gray-200 dark:border-gray-700">
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
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "center",
                            }}
                          >
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setSelectedRecord(record)}
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
                            >
                              View Details
                            </motion.button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "3rem 0" }}>
              <p
                style={{
                  color: "#6b7280",
                  fontSize: 14,
                  fontStyle: "italic",
                }}
              >
                📭 No records found matching your criteria.
              </p>
            </div>
          )}
        </motion.div>
      </div>
        </main>
      </div>

      {/* Modal for Detailed Record */}
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
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <h2 className="text-gray-900 dark:text-gray-100 text-xl font-semibold mb-5">
                {selectedRecord.clientName} — Session Details
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-5 text-sm">
                Counselor: <strong>{selectedRecord.counselor}</strong> | Date:{" "}
                <strong>
                  {new Date(selectedRecord.date).toLocaleDateString()}
                </strong>
              </p>

              <div className="mb-4">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border-l-4 border-indigo-500 dark:border-indigo-400 text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Status
                  </div>
                  <div className="text-xl font-semibold text-indigo-600 dark:text-indigo-400">
                    {selectedRecord.status}
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                  Notes
                </label>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm min-h-[80px] max-h-[200px] overflow-y-auto">
                  {selectedRecord.notes || "No notes available"}
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">
                  Outcome
                </label>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm min-h-[80px]">
                  {selectedRecord.outcomes || selectedRecord.outcome || "No outcome recorded"}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedRecord(null)}
                  className="px-5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </motion.button>
                {canGenerateReports && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleDownloadPDF}
                    style={{
                      background: "linear-gradient(90deg, #10b981, #059669)",
                      color: "white",
                      padding: "10px 20px",
                      borderRadius: 10,
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 14,
                      boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                    }}
                  >
                    Download PDF
                  </motion.button>
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
