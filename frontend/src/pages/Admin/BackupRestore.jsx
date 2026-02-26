import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import { motion } from "framer-motion";
import AdminSidebar from "../../components/AdminSidebar";
import { initializeTheme } from "../../utils/themeUtils";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function BackupRestore() {
  useDocumentTitle("Backup & Restore");
  const navigate = useNavigate();

  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backups, setBackups] = useState([]);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  useEffect(() => {
    initializeTheme();
  }, []);

  // Initial auth + data fetch
  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      navigate("/adminlogin");
      return;
    }

    fetchAdmin();
    fetchBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, pagination.page, statusFilter]);

  const fetchAdmin = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await axios.get(`${BASE_URL}/api/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data) {
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

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("adminToken");
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (statusFilter) params.status = statusFilter;

      const res = await axios.get(`${BASE_URL}/api/admin/backups`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      if (res.data?.success) {
        setBackups(res.data.backups || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (error) {
      console.error("Error fetching backups:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "Failed to fetch backups",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    const result = await Swal.fire({
      title: "Create Backup?",
      text: "This will create a complete backup of all system data. This may take a few moments.",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#4f46e5",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, create backup",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    try {
      setCreatingBackup(true);
      const token = localStorage.getItem("adminToken");
      const res = await axios.post(
        `${BASE_URL}/api/admin/backups`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        await Swal.fire({
          icon: "success",
          title: "Success!",
          text: "Backup created successfully",
          timer: 2000,
        });
        fetchBackups();
      }
    } catch (error) {
      console.error("Error creating backup:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "Failed to create backup",
      });
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleRestoreBackup = async (backupId, backupName) => {
    const result = await Swal.fire({
      title: "⚠️ Warning: Restore Backup?",
      html: `
        <div style="text-align: left;">
          <p><strong>You are about to restore from:</strong></p>
          <p style="color: #4f46e5; font-weight: bold;">${backupName}</p>
          <br/>
          <p><strong>⚠️ IMPORTANT:</strong></p>
          <ul style="text-align: left; margin-left: 20px;">
            <li>This action will <strong style="color: #dc2626;">OVERWRITE</strong> all current system data</li>
            <li>This action <strong style="color: #dc2626;">CANNOT BE UNDONE</strong></li>
            <li>All data created after this backup will be lost</li>
            <li>Users currently logged in may lose unsaved work</li>
          </ul>
          <br/>
          <p style="color: #dc2626; font-weight: bold;">Are you absolutely sure you want to proceed?</p>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, restore (I understand the risks)",
      cancelButtonText: "Cancel",
      reverseButtons: true,
      focusConfirm: false,
    });

    if (!result.isConfirmed) return;

    try {
      setRestoringId(backupId);
      const token = localStorage.getItem("adminToken");
      const res = await axios.post(
        `${BASE_URL}/api/admin/backups/${backupId}/restore`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        await Swal.fire({
          icon: "success",
          title: "Restore Started",
          text: "System is restoring from the selected backup.",
          timer: 2500,
        });
        fetchBackups();
      }
    } catch (error) {
      console.error("Error restoring backup:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "Failed to restore backup",
      });
    } finally {
      setRestoringId(null);
    }
  };

  const handleDownloadBackup = async (backupId) => {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await axios.get(
        `${BASE_URL}/api/admin/backups/${backupId}/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        }
      );

      const blob = new Blob([res.data], {
        type: "application/zip,application/octet-stream",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup-${backupId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading backup:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: error.response?.data?.message || "Failed to download backup",
      });
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "success":
        return "✅";
      case "failed":
        return "❌";
      case "pending":
        return "⏸️";
      default:
        return "❓";
    }
  };

  const handlePageChange = (direction) => {
    setPagination((prev) => {
      const nextPage =
        direction === "next" ? prev.page + 1 : Math.max(1, prev.page - 1);
      if (nextPage === prev.page) return prev;
      return { ...prev, page: nextPage };
    });
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 font-sans p-4 md:p-8 gap-6">
      {/* Top Progress Bar - page-level loading indicator */}
      {loading && (
        <div className="fixed top-0 left-0 w-full z-[9999] pointer-events-none">
          <div
            className="h-1 bg-indigo-500 rounded-b shadow-[0_0_8px_rgba(79,70,229,0.6)] animate-pulse"
            style={{ width: "100%" }}
          />
        </div>
      )}

      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        {/* Left: Sidebar */}
        <AdminSidebar />

        {/* Right: Main content */}
        <main className="w-full">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm mb-4">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 m-0">
                  Backup & Restore
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1 text-xs">
                  Create backups of your system data and restore from previous
                  backups.
                </p>
              </div>
              <button
                onClick={handleCreateBackup}
                disabled={creatingBackup}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {creatingBackup ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Creating...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                    Backup Now
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Filters + Stats */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm mb-4 flex flex-col md:flex-row md:items-center gap-4 justify-between"
          >
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Total Backups
              </p>
              <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                {pagination.total || backups.length}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-600 dark:text-gray-300">
                Status:
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </motion.div>

          {/* Backups Table */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Backup History ({pagination.total || backups.length})
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Name
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Status
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Created At
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Size
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {backups.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 px-3 text-center text-xs text-gray-500 dark:text-gray-400"
                      >
                        No backups found.
                      </td>
                    </tr>
                  )}

                  {backups.map((backup) => (
                    <tr key={backup._id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="py-2 px-3">
                        <div className="text-xs font-medium text-gray-900 dark:text-gray-100">
                          {backup.backupName || "Backup"}
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">
                          {backup.backupId}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(
                            backup.status
                          )}`}
                        >
                          <span>{getStatusIcon(backup.status)}</span>
                          <span className="capitalize">
                            {backup.status || "unknown"}
                          </span>
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400">
                        {backup.createdAt
                          ? new Date(backup.createdAt).toLocaleString()
                          : "N/A"}
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-600 dark:text-gray-400">
                        {backup.size
                          ? `${(backup.size / (1024 * 1024)).toFixed(2)} MB`
                          : "N/A"}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              handleDownloadBackup(backup._id || backup.backupId)
                            }
                            className="px-2 py-1 text-xs rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors"
                          >
                            Download
                          </button>
                          <button
                            onClick={() =>
                              handleRestoreBackup(
                                backup._id || backup.backupId,
                                backup.backupName || backup.backupId
                              )
                            }
                            disabled={restoringId === (backup._id || backup.backupId)}
                            className="px-2 py-1 text-xs rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {restoringId === (backup._id || backup.backupId)
                              ? "Restoring..."
                              : "Restore"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex justify-between items-center mt-4">
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Page {pagination.page} of {pagination.pages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange("prev")}
                    disabled={pagination.page === 1}
                    className="px-2 py-1 text-xs rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange("next")}
                    disabled={pagination.page >= pagination.pages}
                    className="px-2 py-1 text-xs rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}


