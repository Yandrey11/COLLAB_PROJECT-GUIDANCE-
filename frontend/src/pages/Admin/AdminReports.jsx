import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import { motion } from "framer-motion";
import AdminSidebar from "../../components/AdminSidebar";
import { initializeTheme } from "../../utils/themeUtils";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const REPORT_TYPES = [
  "Counseling Records Report",
  "Counselor Activity Report",
  "Generated Files Report",
  "User Account Report",
  "System Logs Report",
];

export default function AdminReports() {
  useDocumentTitle("Admin Reports");
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Counseling Records Report");

  // Overview stats
  const [overview, setOverview] = useState({
    totalRecords: 0,
    completedSessions: 0,
    ongoingSessions: 0,
    totalCounselors: 0,
    totalPDFs: 0,
    filesUploaded: 0,
  });

  // Filters
  const [filters, setFilters] = useState({
    clientName: "",
    counselorName: "",
    status: "",
    recordType: "",
    sessionType: "",
    startDate: "",
    endDate: "",
    counselorId: "",
  });

  // Generated reports list
  const [reports, setReports] = useState([]);
  const [reportsPagination, setReportsPagination] = useState({
    page: 1,
    limit: 3,
    total: 0,
    totalPages: 0,
  });

  // Filtered records for current report type
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [recordsPagination, setRecordsPagination] = useState({
    page: 1,
    limit: 3,
    total: 0,
    totalPages: 0,
  });

  // Counselors list for filter
  const [counselors, setCounselors] = useState([]);

  // Report generation
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportName, setReportName] = useState("");
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // View report modal
  const [selectedReport, setSelectedReport] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  // Filters visibility
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    initializeTheme();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      navigate("/adminlogin");
      return;
    }

    fetchAdmin();
    fetchOverview();
    fetchCounselors();
    fetchReports();
    fetchFilteredRecords();
  }, [navigate]);

  useEffect(() => {
    fetchFilteredRecords();
  }, [filters, recordsPagination.page, activeTab]);

  useEffect(() => {
    fetchReports();
  }, [reportsPagination.page, activeTab]);

  const fetchAdmin = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await axios.get(`${BASE_URL}/api/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data && res.data.name) {
        setAdmin(res.data);
      }
    } catch (error) {
      console.error("Error fetching admin:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem("adminToken");
        navigate("/adminlogin");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchOverview = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await axios.get(`${BASE_URL}/api/admin/reports/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.success && res.data.overview) {
        setOverview(res.data.overview);
      }
    } catch (error) {
      console.error("Error fetching overview:", error);
    }
  };

  const fetchCounselors = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await axios.get(`${BASE_URL}/api/admin/reports/counselors`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.success && res.data.counselors) {
        setCounselors(res.data.counselors);
      }
    } catch (error) {
      console.error("Error fetching counselors:", error);
    }
  };

  const fetchFilteredRecords = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const params = {
        reportType: activeTab,
        page: recordsPagination.page,
        limit: recordsPagination.limit,
        ...filters,
      };

      // Remove empty filters
      Object.keys(params).forEach((key) => {
        if (!params[key] || params[key] === "all") {
          delete params[key];
        }
      });

      const res = await axios.get(`${BASE_URL}/api/admin/reports/records`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      if (res.data.success) {
        setFilteredRecords(res.data.records || []);
        setRecordsPagination(res.data.pagination || recordsPagination);
      }
    } catch (error) {
      console.error("Error fetching filtered records:", error);
      if (error.response?.data?.message) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.response.data.message,
        });
      }
    }
  };

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const params = {
        page: reportsPagination.page,
        limit: reportsPagination.limit,
        reportType: activeTab,
        sortBy: "createdAt",
        order: "desc",
      };

      const res = await axios.get(`${BASE_URL}/api/admin/reports`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      if (res.data.success) {
        setReports(res.data.reports || []);
        setReportsPagination(res.data.pagination || reportsPagination);
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
    }
  };

  const handleGenerateReport = async () => {
    if (!reportName.trim()) {
      Swal.fire({
        icon: "error",
        title: "Validation Error",
        text: "Please enter a report name",
      });
      return;
    }

    setGeneratingReport(true);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await axios.post(
        `${BASE_URL}/api/admin/reports/generate`,
        {
          reportType: activeTab,
          reportName: reportName.trim(),
          ...filters,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.data.success) {
        // Automatically download the PDF
        if (res.data.report?.downloadPath) {
          try {
            const token = localStorage.getItem("adminToken");
            const downloadRes = await fetch(
              `${BASE_URL}${res.data.report.downloadPath}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            // Check if response is a PDF blob
            const contentType = downloadRes.headers.get("content-type");
            if (contentType && contentType.includes("application/pdf")) {
              // It's a PDF file - download it
              const blob = await downloadRes.blob();
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = res.data.report.fileName || "report.pdf";
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(url);
            } else {
              // It's JSON (Drive link fallback) - parse and open in new tab
              const data = await downloadRes.json();
              if (data.downloadLink) {
                window.open(data.downloadLink, "_blank");
              }
            }
          } catch (downloadError) {
            console.error("Error downloading PDF:", downloadError);
            // Still show success even if download fails
          }
        }

        await Swal.fire({
          icon: "success",
          title: "Success!",
          text: res.data.message || "Report generated and downloaded successfully",
          timer: 2000,
          showConfirmButton: false,
        });

        setShowGenerateModal(false);
        setReportName("");
        fetchReports();
        fetchOverview();
      }
    } catch (error) {
      console.error("Error generating report:", error);
      Swal.fire({
        icon: "error",
        title: "Generation Failed",
        text: error.response?.data?.message || "Failed to generate report. Please try again.",
      });
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleViewReport = async (report) => {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await axios.get(`${BASE_URL}/api/admin/reports/${report._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.success) {
        setSelectedReport(res.data.report);
        setShowViewModal(true);
      }
    } catch (error) {
      console.error("Error viewing report:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "Failed to fetch report details",
      });
    }
  };

  const handleDownloadReport = async (report) => {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await axios.get(`${BASE_URL}/api/admin/reports/${report._id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.success && res.data.downloadLink) {
        // Open download link in new tab
        window.open(res.data.downloadLink, "_blank");
      } else {
        Swal.fire({
          icon: "error",
          title: "Download Failed",
          text: "Report file not available",
        });
      }
    } catch (error) {
      console.error("Error downloading report:", error);
      Swal.fire({
        icon: "error",
        title: "Download Failed",
        text: error.response?.data?.message || "Failed to download report",
      });
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setRecordsPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleGenerateRecordPDF = async (recordId, clientName) => {
    try {
      const token = localStorage.getItem("adminToken") || localStorage.getItem("token");
      if (!token) {
        Swal.fire({
          icon: "error",
          title: "Authentication Error",
          text: "Please log in again.",
        });
        navigate("/login");
        return;
      }

      // Show loading
      Swal.fire({
        title: "Generating PDF...",
        text: "Please wait while we generate the PDF for this record.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      // Call the API endpoint
      let response;
      try {
        response = await axios.get(`${BASE_URL}/api/records/${recordId}/generate-pdf`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: "blob", // Important: expect binary data
          validateStatus: function (status) {
            // Don't throw error for non-2xx responses, we'll handle them manually
            return status < 500; // Only throw for server errors
          },
        });
      } catch (networkError) {
        // Network or connection error
        throw new Error("Network error. Please check your connection and try again.");
      }

      // Check if response status indicates an error
      if (response.status !== 200) {
        // Try to parse error message from blob
        let errorMessage = "Failed to generate PDF. Please try again.";
        try {
          const text = await response.data.text();
          const errorJson = JSON.parse(text);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch (e) {
          // If parsing fails, use default message
        }
        throw new Error(errorMessage);
      }

      // Check if response is actually a PDF (check content type)
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('application/pdf')) {
        // If it's not a PDF, it might be an error JSON response
        let errorMessage = "Failed to generate PDF. Please try again.";
        try {
          const text = await response.data.text();
          const errorJson = JSON.parse(text);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch (e) {
          // If parsing fails, use default message
        }
        throw new Error(errorMessage);
      }

      // Create a blob from the response
      const blob = new Blob([response.data], { type: "application/pdf" });
      
      // Verify blob is not empty
      if (blob.size === 0) {
        throw new Error("Generated PDF is empty. Please try again.");
      }
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      // Generate filename from client name
      const sanitizedClientName = (clientName || "Record").replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `${sanitizedClientName}_${new Date().toISOString().split("T")[0]}.pdf`;
      link.download = fileName;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Close loading and show success message
      Swal.close();
      Swal.fire({
        icon: "success",
        title: "PDF Generated!",
        text: "The PDF has been generated and downloaded successfully.",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      Swal.close();
      
      let errorMessage = "Failed to generate PDF. Please try again.";
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response) {
        // Handle error response
        if (error.response.data instanceof Blob) {
          // If it's a blob, try to parse it as JSON (async)
          error.response.data.text().then(text => {
            try {
              const errorJson = JSON.parse(text);
              errorMessage = errorJson.error || errorJson.message || errorMessage;
            } catch (e) {
              // If parsing fails, use status-based message
              errorMessage = error.response.status === 404 
                ? "Record not found." 
                : error.response.status === 401
                ? "Unauthorized. Please log in again."
                : errorMessage;
            }
            Swal.fire({
              icon: "error",
              title: "Error",
              text: errorMessage,
            });
          }).catch(() => {
            // Fallback if text parsing fails
            Swal.fire({
              icon: "error",
              title: "Error",
              text: errorMessage,
            });
          });
          return; // Exit early since we're handling async
        } else if (typeof error.response.data === 'object') {
          errorMessage = error.response.data.error || error.response.data.message || errorMessage;
        } else {
          // Use status-based message
          errorMessage = error.response.status === 404 
            ? "Record not found." 
            : error.response.status === 401
            ? "Unauthorized. Please log in again."
            : errorMessage;
        }
      }
      
      Swal.fire({
        icon: "error",
        title: "Error",
        text: errorMessage,
      });
    }
  };

  const handleResetFilters = () => {
    setFilters({
      clientName: "",
      counselorName: "",
      status: "",
      recordType: "",
      sessionType: "",
      startDate: "",
      endDate: "",
      counselorId: "",
    });
    setRecordsPagination((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center page-bg font-sans p-4 md:p-8 gap-6">
      {/* Top Progress Bar - Shows when loading */}
      {loading && (
        <div className="fixed top-0 left-0 w-full z-[9999] pointer-events-none">
          <div className="h-1 bg-indigo-500 rounded-b shadow-[0_0_8px_rgba(79,70,229,0.6)] animate-pulse" style={{ width: '100%' }} />
        </div>
      )}
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        {/* Sidebar */}
        <AdminSidebar />

        {/* Main Content */}
        <main className="w-full">
          {/* Page Title */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm mb-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 m-0">
              Admin Reports
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-xs">
              Generate, view, and download system-wide reports for counseling records, activities, and analytics.
            </p>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm"
            >
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Records</div>
              <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                {overview.totalRecords.toLocaleString()}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm"
            >
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Completed Sessions</div>
              <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                {overview.completedSessions.toLocaleString()}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm"
            >
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Ongoing Sessions</div>
              <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                {overview.ongoingSessions.toLocaleString()}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm"
            >
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Counselors</div>
              <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                {overview.totalCounselors.toLocaleString()}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm"
            >
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Generated PDFs</div>
              <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                {overview.totalPDFs.toLocaleString()}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm"
            >
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Drive Uploads</div>
              <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                {overview.filesUploaded.toLocaleString()}
              </div>
            </motion.div>
          </div>

          {/* Report Type Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Report Type:</span>
              {REPORT_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    activeTab === type
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors mb-3"
              >
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Filters
                </span>
                <span className="text-gray-600 dark:text-gray-400 text-xs">
                  {showFilters ? "▲" : "▼"}
                </span>
              </button>
              
              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Client Name
                  </label>
                  <input
                    type="text"
                    value={filters.clientName}
                    onChange={(e) => handleFilterChange("clientName", e.target.value)}
                    placeholder="Search client..."
                    className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Counselor
                  </label>
                  <select
                    value={filters.counselorId}
                    onChange={(e) => handleFilterChange("counselorId", e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">All Counselors</option>
                    {counselors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange("status", e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">All Status</option>
                    <option value="Completed">Completed</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Referred">Referred</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date Range (Start)
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange("startDate", e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date Range (End)
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange("endDate", e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={handleResetFilters}
                    className="px-3 py-1.5 text-xs rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setShowGenerateModal(true)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Generate PDF
                  </button>
                </div>
              </div>
              )}
            </div>
          </div>

          {/* Filtered Records Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm mb-4">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">
              Records ({recordsPagination.total})
            </h2>
            {filteredRecords.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-500 dark:text-gray-400">
                No data found for the selected criteria.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Client Name
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Counselor
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Date
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Status
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((record) => (
                        <tr
                          key={record._id}
                          className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <td className="py-2 px-3 text-xs text-gray-900 dark:text-gray-100">
                            {record.clientName}
                          </td>
                          <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400">
                            {record.counselor}
                          </td>
                          <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400">
                            {record.date ? new Date(record.date).toLocaleDateString() : "N/A"}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                record.status === "Completed"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : record.status === "Ongoing"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                  : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                              }`}
                            >
                              {record.status}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <button
                              onClick={() => handleGenerateRecordPDF(record._id, record.clientName)}
                              className="px-2 py-1 text-xs rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors"
                            >
                              📄 Generate PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination for Records */}
                {recordsPagination.totalPages > 1 && (
                  <div className="flex justify-between items-center mt-4">
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Page {recordsPagination.page} of {recordsPagination.totalPages}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setRecordsPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                        }
                        disabled={recordsPagination.page === 1}
                        className="px-2 py-1 text-xs rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() =>
                          setRecordsPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                        }
                        disabled={recordsPagination.page >= recordsPagination.totalPages}
                        className="px-2 py-1 text-xs rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Generated Reports List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">
              Generated Reports ({reportsPagination.total})
            </h2>
            {reports.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-500 dark:text-gray-400">
                No reports generated yet. Click "Generate PDF" to create your first report.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Report Name
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Type
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Tracking Number
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Generated By
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Date
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((report) => (
                        <tr
                          key={report._id}
                          className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <td className="py-2 px-3 text-xs font-medium text-gray-900 dark:text-gray-100">
                            {report.reportName}
                          </td>
                          <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400">
                            {report.reportType}
                          </td>
                          <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400 font-mono">
                            {report.trackingNumber}
                          </td>
                          <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400">
                            {report.generatedBy?.userName || "Unknown"}
                          </td>
                          <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400">
                            {report.createdAt
                              ? new Date(report.createdAt).toLocaleDateString()
                              : "N/A"}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleViewReport(report)}
                                className="px-2 py-1 text-xs rounded-lg bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-medium hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                              >
                                View
                              </button>
                              {report.driveLink && (
                                <button
                                  onClick={() => handleDownloadReport(report)}
                                  className="px-2 py-1 text-xs rounded-lg bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 font-medium hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                                >
                                  Download
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination for Reports */}
                {reportsPagination.totalPages > 1 && (
                  <div className="flex justify-between items-center mt-4">
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Page {reportsPagination.page} of {reportsPagination.totalPages}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setReportsPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                        }
                        disabled={reportsPagination.page === 1}
                        className="px-2 py-1 text-xs rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() =>
                          setReportsPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                        }
                        disabled={reportsPagination.page >= reportsPagination.totalPages}
                        className="px-2 py-1 text-xs rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Generate Report
            </h2>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Report Name
              </label>
              <input
                type="text"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                placeholder="Enter report name..."
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="mb-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Report Type: <span className="font-semibold">{activeTab}</span>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowGenerateModal(false);
                  setReportName("");
                }}
                className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={generatingReport}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generatingReport ? "Generating..." : "Generate PDF"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* View Report Modal */}
      {showViewModal && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              Report Details
            </h2>
            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Report Name
                </div>
                <div className="text-sm text-gray-900 dark:text-gray-100">{selectedReport.reportName}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Tracking Number
                </div>
                <div className="text-xs text-gray-900 dark:text-gray-100 font-mono">
                  {selectedReport.trackingNumber}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Generated By
                </div>
                <div className="text-sm text-gray-900 dark:text-gray-100">
                  {selectedReport.generatedBy?.userName || "Unknown"}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Generated Date
                </div>
                <div className="text-sm text-gray-900 dark:text-gray-100">
                  {selectedReport.createdAt
                    ? new Date(selectedReport.createdAt).toLocaleString()
                    : "N/A"}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Statistics
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {selectedReport.statistics && Object.entries(selectedReport.statistics).map(([key, value]) => {
                    const label = key
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (str) => str.toUpperCase())
                      .trim();
                    return (
                      <div
                        key={key}
                        className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg"
                      >
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {label}
                        </div>
                        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          {typeof value === "number" ? value.toLocaleString() : value || "0"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              {selectedReport.driveLink && (
                <button
                  onClick={() => {
                    window.open(selectedReport.driveLink, "_blank");
                  }}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors"
                >
                  Open in Drive
                </button>
              )}
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedReport(null);
                }}
                className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

