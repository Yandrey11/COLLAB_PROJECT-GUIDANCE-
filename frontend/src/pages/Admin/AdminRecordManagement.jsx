import { useEffect, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import AdminSidebar from "../../components/AdminSidebar";
import { initializeTheme } from "../../utils/themeUtils";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { formatProblemsPresentedDisplay } from "../../constants/problemsPresented";

const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/admin/records`;

export default function AdminRecordManagement() {
  useDocumentTitle("Admin Record Management");
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [admin, setAdmin] = useState(null);

  // Search and filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sessionTypeFilter, setSessionTypeFilter] = useState("all");
  const [counselorFilter, setCounselorFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // Sort
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");

  // Available counselors for filter
  const [counselors, setCounselors] = useState([]);

  // Lock status (read-only — counselors use locks when editing)
  const [lockStatuses, setLockStatuses] = useState({}); // { recordId: { locked, lockedBy, canLock, canUnlock, isLockOwner } }
  const [allLockLogs, setAllLockLogs] = useState([]); // All lock/unlock logs for the card
  const [lockLogFilter, setLockLogFilter] = useState("all"); // Filter: "all", "LOCK", "UNLOCK", "UPDATE"
  const [showLockLogsCard, setShowLockLogsCard] = useState(true); // Toggle to show/hide the lock logs card
  
  // Dropdown menu state
  const [openDropdownId, setOpenDropdownId] = useState(null);
  
  // Toggle to show/hide action buttons
  const [showActions, setShowActions] = useState(true);

  // Admin recommendation modal (replaces SweetAlert prompt)
  const [showRecommendationModal, setShowRecommendationModal] = useState(false);
  const [recommendationRecord, setRecommendationRecord] = useState(null);
  const [recommendationDraft, setRecommendationDraft] = useState("");
  const [recommendationSaving, setRecommendationSaving] = useState(false);
  const [recommendationError, setRecommendationError] = useState(null);

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdownId && !event.target.closest('.dropdown-container')) {
        setOpenDropdownId(null);
      }
    };

    if (openDropdownId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openDropdownId]);

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      navigate("/adminlogin");
      return;
    }

    // Verify admin access
    axios
      .get(`${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (res.data.role !== "admin") {
          navigate("/adminlogin");
          return;
        }
        setAdmin(res.data);
        fetchRecords();
        fetchAllLockLogs();
      })
      .catch(() => {
        navigate("/adminlogin");
      });
  }, [navigate]);

  // Refresh all lock logs when records are updated
  useEffect(() => {
    if (records.length > 0) {
      fetchAllLockLogs();
    }
  }, [records]);

  // Fetch records with current filters and pagination
  const fetchRecords = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("adminToken");
      const params = {
        page: currentPage,
        limit: pageSize,
        search,
        status: statusFilter,
        sessionType: sessionTypeFilter,
        counselor: counselorFilter,
        startDate,
        endDate,
        sortBy,
        order: sortOrder,
      };

      const res = await axios.get(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      setRecords(res.data.records || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotalRecords(res.data.pagination?.totalRecords || 0);
      setCounselors(res.data.filters?.counselors || []);
    } catch (error) {
      console.error("Error fetching records:", error);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to fetch records",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch lock status for a record
  const fetchLockStatus = async (recordId) => {
    try {
      const token = localStorage.getItem("adminToken");
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

  // Fetch all lock statuses when records are loaded
  useEffect(() => {
    if (records.length > 0) {
      records.forEach((record) => {
        fetchLockStatus(record._id);
      });
    }
  }, [records]);

  // Fetch all lock/unlock logs
  const fetchAllLockLogs = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const params = { limit: 50 }; // Get more logs to allow filtering
      if (lockLogFilter !== "all") {
        params.action = lockLogFilter;
      }
      const response = await axios.get(`${baseUrl}/api/admin/lock-logs/all`, {
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

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentPage === 1) {
        fetchRecords();
      } else {
        setCurrentPage(1);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Fetch when filters or pagination change
  useEffect(() => {
    fetchRecords();
  }, [currentPage, pageSize, statusFilter, sessionTypeFilter, counselorFilter, startDate, endDate, sortBy, sortOrder]);

  // View record details
  const handleViewRecord = (record) => {
    setSelectedRecord(record);
    setShowDetailModal(true);
  };

  const openRecommendationModal = (record) => {
    setOpenDropdownId(null);
    setRecommendationRecord(record);
    setRecommendationDraft(record.recommendation || "");
    setRecommendationError(null);
    setShowRecommendationModal(true);
  };

  const closeRecommendationModal = () => {
    setShowRecommendationModal(false);
    setRecommendationRecord(null);
    setRecommendationDraft("");
    setRecommendationError(null);
    setRecommendationSaving(false);
  };

  const saveRecommendation = async () => {
    if (!recommendationRecord) return;
    const recordId = recommendationRecord._id ?? recommendationRecord.id;
    if (!recordId) {
      setRecommendationError("This record has no id. Refresh the page and try again.");
          return;
        }
      const token = localStorage.getItem("adminToken");
    setRecommendationSaving(true);
    setRecommendationError(null);
    try {
      const { data } = await axios.patch(
        `${API_URL}/${recordId}/recommendation`,
        { recommendation: recommendationDraft },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (showDetailModal && (selectedRecord?._id ?? selectedRecord?.id) === recordId && data?.record) {
        setSelectedRecord(data.record);
      }

      closeRecommendationModal();
      fetchRecords();
    } catch (err) {
      console.error("Quick recommendation error:", err);
      const serverMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        (err.message && !err.response ? err.message : null);
      setRecommendationError(serverMsg || "Failed to save recommendation.");
    } finally {
      setRecommendationSaving(false);
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setSessionTypeFilter("all");
    setCounselorFilter("all");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString();
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case "Completed":
        return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
      case "Ongoing":
        return "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400";
      case "Referred":
        return "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400";
      default:
        return "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300";
    }
  };

  const inputClass =
    "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm transition-all placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400";
  const recommendationTextareaClass =
    "min-h-[168px] w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm leading-relaxed text-gray-900 shadow-sm transition-all placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400";
  const labelClass =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500";
  const selectClass = `${inputClass} cursor-pointer`;

  return (
    <div className="min-h-screen w-full page-bg counselor-typography font-sans text-gray-900 dark:text-gray-100">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="flex flex-col gap-8">
          <motion.header
            initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6 border-b border-gray-200/80 pb-8 dark:border-gray-700/80 sm:flex-row sm:items-start sm:justify-between lg:pb-10"
          >
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <AdminSidebar variant="header" />
              <div className="hidden h-10 w-px shrink-0 bg-gray-200 dark:bg-gray-700 sm:block" aria-hidden />
              <div className="min-w-0 space-y-2">
                <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                  Administration
                </p>
                <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 sm:text-3xl">
                  Records
                </h1>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  Browse sessions, inspect lock state, and add recommendations. Counselors edit session content.
                </p>
              </div>
            </div>
            {!showActions && (
              <button
                type="button"
                onClick={() => setShowActions(true)}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-xs font-medium text-gray-800 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
              >
                <svg className="h-4 w-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
                Show row actions
              </button>
            )}
          </motion.header>

          <motion.section
            initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-sm dark:border-gray-700/90 dark:bg-gray-800/80 sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
              <div className="min-w-0 flex-1 space-y-2">
                <label htmlFor="admin-record-search" className={labelClass}>
                Search
              </label>
              <input
                  id="admin-record-search"
                type="text"
                  placeholder="Client or counselor…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                  className={inputClass}
              />
            </div>
            <button
                type="button"
              onClick={() => setShowFilters(!showFilters)}
                aria-expanded={showFilters}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 text-sm font-medium text-gray-800 transition hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/80"
              >
                {showFilters ? "Hide filters" : "Filters"}
                <svg
                  className={`h-4 w-4 text-gray-500 transition-transform ${showFilters ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
            </button>
          </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
                  <div className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-600">
                    <p className={labelClass}>Refine</p>
                    <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                        <label className={labelClass}>Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                          className={selectClass}
                    >
                          <option value="all">All</option>
                      <option value="Ongoing">Ongoing</option>
                      <option value="Completed">Completed</option>
                      <option value="Referred">Referred</option>
                    </select>
                  </div>
                  <div>
                        <label className={labelClass}>Session type</label>
                    <input
                      type="text"
                          placeholder="Filter by type…"
                      value={sessionTypeFilter === "all" ? "" : sessionTypeFilter}
                      onChange={(e) => setSessionTypeFilter(e.target.value || "all")}
                          className={inputClass}
                    />
                  </div>
                      <div className="sm:col-span-2 lg:col-span-2">
                        <label className={labelClass}>Counselor</label>
                    <select
                      value={counselorFilter}
                      onChange={(e) => setCounselorFilter(e.target.value)}
                          className={selectClass}
                    >
                          <option value="all">All counselors</option>
                      {counselors.map((counselor) => (
                        <option key={counselor} value={counselor}>
                          {counselor}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                    <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                        <label className={labelClass}>Start date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                          className={inputClass}
                    />
                  </div>
                  <div>
                        <label className={labelClass}>End date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                          className={inputClass}
                    />
                  </div>
                  <div>
                        <label className={labelClass}>Sort by</label>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className={selectClass}>
                      <option value="date">Date</option>
                          <option value="clientName">Client name</option>
                      <option value="counselor">Counselor</option>
                      <option value="status">Status</option>
                    </select>
                  </div>
                  <div>
                        <label className={labelClass}>Order</label>
                        <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={selectClass}>
                          <option value="desc">Newest first</option>
                          <option value="asc">Oldest first</option>
                    </select>
                  </div>
                </div>
                    <div className="mt-6 flex justify-end">
                  <button
                        type="button"
                    onClick={handleClearFilters}
                        className="text-sm font-medium text-gray-600 underline-offset-4 hover:text-gray-900 hover:underline dark:text-gray-400 dark:hover:text-gray-200"
                  >
                        Clear all filters
                  </button>
                    </div>
                </div>
            </motion.div>
          )}
        </AnimatePresence>
          </motion.section>

        {/* Records directory */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm dark:border-gray-700/90 dark:bg-gray-800/80"
        >
          <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-600 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">Directory</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {totalRecords === 1 ? "1 record" : `${totalRecords} records`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-500">Rows</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-900 shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="px-2 pb-6 pt-2 sm:px-4 sm:pb-8">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">Loading records…</div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">No records match your filters.</div>
          ) : (
            <div className="-mx-2 overflow-x-auto sm:mx-0">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm text-gray-900 dark:text-gray-100">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80 dark:border-gray-600 dark:bg-gray-900/20">
                    <th className="whitespace-nowrap px-3 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:px-4">
                      Client
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:px-4">
                      Date
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:px-4">
                      Session
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:px-4">
                      Type
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:px-4">
                      Status
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:px-4">
                      Counselor
                    </th>
                    <th className="whitespace-nowrap px-3 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:px-4">
                      Lock
                    </th>
                      {showActions && (
                        <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:px-4">
                          <div className="flex items-center justify-center gap-2">
                            <span>Actions</span>
                            <button
                              type="button"
                              onClick={() => setShowActions(false)}
                              className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                              title="Hide actions column"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </th>
                      )}
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr
                      key={record._id}
                      className="border-b border-gray-200 transition-colors last:border-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-3 py-3.5 font-medium text-gray-900 dark:text-gray-100 sm:px-4">
                        {record.clientName}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-gray-600 dark:text-gray-300 sm:px-4">
                        {formatDate(record.date)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 tabular-nums text-gray-600 dark:text-gray-300 sm:px-4">
                        #{record.sessionNumber}
                      </td>
                      <td className="px-3 py-3.5 text-gray-600 dark:text-gray-300 sm:px-4">{record.sessionType}</td>
                      <td className="px-3 py-3.5 sm:px-4">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${getStatusColor(record.status)}`}
                        >
                          {record.status}
                        </span>
                      </td>
                      <td className="max-w-[10rem] truncate px-3 py-3.5 text-gray-600 dark:text-gray-300 sm:max-w-none sm:px-4">
                        {record.counselor}
                      </td>
                      <td className="px-3 py-3.5 sm:px-4">
                        {(() => {
                          const lockStatus = lockStatuses[record._id];
                          if (!lockStatus) {
                            return (
                              <span className="text-xs text-gray-400 dark:text-gray-500">…</span>
                            );
                          }
                          if (lockStatus.locked) {
                            const isOwner = lockStatus.isLockOwner;
                            return (
                              <div className="flex max-w-[11rem] flex-col gap-0.5">
                                <span
                                  className={`text-xs font-medium leading-snug ${
                                    isOwner ? "text-emerald-700 dark:text-emerald-400" : "text-amber-800 dark:text-amber-400"
                                  }`}
                                >
                                  Locked
                                  <span className="font-normal text-gray-500 dark:text-gray-400">
                                    {" · "}
                                    {lockStatus.lockedBy?.userName || "—"}
                                  </span>
                                </span>
                                {lockStatus.lockedBy?.userRole === "admin" && (
                                  <span className="text-[10px] uppercase tracking-wide text-gray-400">Admin</span>
                                )}
                              </div>
                            );
                          }
                          return (
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Open</span>
                          );
                        })()}
                      </td>
                      {showActions && (
                        <td className="px-3 py-3.5 text-center sm:px-4">
                          <div className="relative inline-block text-left dropdown-container">
                          <button
                              type="button"
                            onClick={() => setOpenDropdownId(openDropdownId === record._id ? null : record._id)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/80"
                          >
                              Menu
                            <svg
                                className={`h-3.5 w-3.5 text-gray-400 transition-transform ${openDropdownId === record._id ? "rotate-180" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          
                          <AnimatePresence>
                            {openDropdownId === record._id && (
                              <motion.div
                                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                                  transition={{ duration: 0.15 }}
                                  className="absolute right-0 z-50 mt-1 min-w-[10.5rem] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg shadow-gray-900/10 dark:border-gray-700 dark:bg-gray-800"
                                onClick={(e) => e.stopPropagation()}
                              >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleViewRecord(record);
                                      setOpenDropdownId(null);
                                    }}
                                    className="flex w-full px-3 py-2 text-left text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                  >
                                    View details
                                  </button>
                                        <button
                                    type="button"
                                    onClick={() => openRecommendationModal(record)}
                                    className="flex w-full px-3 py-2 text-left text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                  >
                                    Recommendation
                                        </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3 border-t border-gray-200 pt-6 dark:border-gray-600">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`h-9 rounded-lg px-4 text-sm font-medium transition ${
                  currentPage === 1
                    ? "cursor-not-allowed text-gray-300 dark:text-gray-600"
                    : "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
                }`}
              >
                Previous
              </button>
              <span className="min-w-[5.5rem] text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={`h-9 rounded-lg px-4 text-sm font-medium transition ${
                  currentPage === totalPages
                    ? "cursor-not-allowed text-gray-300 dark:text-gray-600"
                    : "border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
                }`}
              >
                Next
              </button>
            </div>
          )}
          </div>
        </motion.section>

        <motion.aside
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-sm dark:border-gray-700/90 dark:bg-gray-800/80 sm:p-6"
        >
          <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 dark:border-gray-600 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Lock activity</h2>
              <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                Recent lock, unlock, and update events across records.
                </p>
              </div>
            <div className="flex flex-wrap items-center gap-2">
                <button
                type="button"
                  onClick={() => setShowLockLogsCard(!showLockLogsCard)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/80"
                >
                  <svg 
                  className={`h-3.5 w-3.5 text-gray-400 transition-transform ${showLockLogsCard ? "rotate-180" : ""}`}
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
                className="h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="all">All</option>
                <option value="LOCK">Lock</option>
                <option value="UNLOCK">Unlock</option>
                <option value="UPDATE">Update</option>
                </select>
                <button
                type="button"
                  onClick={fetchAllLockLogs}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/80"
                >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
                >
                  {(() => {
                  const filteredLogs =
                    lockLogFilter === "all"
                      ? allLockLogs 
                      : allLockLogs.filter((log) => log.action === lockLogFilter);
                    
                    return filteredLogs.length === 0 ? (
                    <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">No activity yet.</p>
                    ) : (
                    <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                        {filteredLogs.map((log, index) => (
                        <li
                          key={index}
                          className="rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-2.5 dark:border-gray-600 dark:bg-gray-700/40"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                              <span
                                className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                  log.action === "LOCK"
                                    ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-400"
                                    : log.action === "UNLOCK"
                                      ? "bg-sky-500/15 text-sky-800 dark:text-sky-400"
                                    : log.action === "UPDATE"
                                        ? "bg-violet-500/15 text-violet-800 dark:text-violet-300"
                                        : "bg-gray-500/10 text-gray-700 dark:text-gray-300"
                                }`}
                              >
                                {log.action}
                              </span>
                              <span className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">
                                {log.performedBy.userName}
                                <span className="font-normal text-gray-500 dark:text-gray-500">
                                  {" · "}
                                  {log.performedBy.userRole}
                                </span>
                              </span>
                              {log.record && (
                                <span className="truncate text-xs text-gray-500 dark:text-gray-400">
                                  {log.record.clientName} · #{log.record.sessionNumber}
                                </span>
                              )}
                            </div>
                            <time className="shrink-0 text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                              {log.timestamp
                                ? new Date(log.timestamp).toLocaleString()
                                : log.createdAt
                                  ? new Date(log.createdAt).toLocaleString()
                                  : "—"}
                            </time>
                          </div>
                          {log.reason && log.reason !== "Auto-locked when editing started" && (
                            <p className="mt-1.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{log.reason}</p>
                          )}
                        </li>
                        ))}
                    </ul>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>
        </motion.aside>
            </div>
      </div>

      <AnimatePresence>
        {showDetailModal && selectedRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-[2px]"
            onClick={() => setShowDetailModal(false)}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="sticky top-0 z-[1] flex items-start justify-between gap-4 border-b border-gray-200 bg-white/95 px-5 py-4 backdrop-blur-sm dark:border-gray-600 dark:bg-gray-800/95">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Session</p>
                  <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                    {selectedRecord.clientName}
                </h2>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    #{selectedRecord.sessionNumber} · {formatDate(selectedRecord.date)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <dl className="grid gap-5 px-5 py-5 sm:px-6 sm:py-6">
                <div className="grid gap-1">
                  <dt className={labelClass}>Type</dt>
                  <dd className="text-sm text-gray-800 dark:text-gray-200">{selectedRecord.sessionType}</dd>
                </div>
                <div className="grid gap-1">
                  <dt className={labelClass}>Status</dt>
                  <dd>
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${getStatusColor(selectedRecord.status)}`}
                    >
                      {selectedRecord.status}
                    </span>
                  </dd>
                  </div>
                <div className="grid gap-1">
                  <dt className={labelClass}>Counselor</dt>
                  <dd className="text-sm text-gray-800 dark:text-gray-200">{selectedRecord.counselor}</dd>
                </div>
                <div className="grid gap-1">
                  <dt className={labelClass}>Problems presented</dt>
                  <dd className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                    {formatProblemsPresentedDisplay(selectedRecord)}
                  </dd>
                </div>
                <div className="grid gap-1">
                  <dt className={labelClass}>Notes</dt>
                  <dd className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                    {selectedRecord.notes || "—"}
                  </dd>
                  </div>
                <div className="grid gap-1">
                  <dt className={labelClass}>Outcomes</dt>
                  <dd className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                    {selectedRecord.outcomes || "—"}
                  </dd>
                </div>
                <div className="grid gap-1 rounded-xl border border-violet-200/80 bg-violet-50/40 p-3 dark:border-violet-900/50 dark:bg-violet-950/20">
                  <dt className={labelClass}>Admin recommendation</dt>
                  <dd className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                    {selectedRecord.recommendation || "—"}
                  </dd>
                </div>
                {selectedRecord.attachments && selectedRecord.attachments.length > 0 && (
                  <div className="grid gap-2">
                    <dt className={labelClass}>Attachments</dt>
                    <dd className="flex flex-col gap-1.5">
                      {selectedRecord.attachments.map((attachment, idx) => (
                          <a
                          key={idx}
                            href={attachment.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          className="text-sm font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
                          >
                            {attachment.fileName}
                          </a>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 bg-gray-50/80 px-5 py-4 dark:border-gray-600 dark:bg-gray-900/30 sm:px-6">
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/80"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => openRecommendationModal(selectedRecord)}
                  className="h-10 rounded-xl bg-gray-900 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                >
                  Add recommendation
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRecommendationModal && recommendationRecord && (
          <motion.div
            key="recommendation-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1001] flex items-center justify-center bg-gray-900/45 p-4 backdrop-blur-[2px]"
            onClick={() => !recommendationSaving && closeRecommendationModal()}
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="shrink-0 border-b border-gray-200 px-5 py-4 dark:border-gray-600 sm:px-6 sm:py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Administrative note
                    </p>
                    <h2 className="mt-1 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                      Recommendation
                  </h2>
                    <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                      Visible to counselors on this record. Keep it concise and actionable.
                    </p>
                </div>
                <button
                    type="button"
                    disabled={recommendationSaving}
                    onClick={closeRecommendationModal}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    aria-label="Close"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
              </div>

                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-3 text-xs dark:border-gray-600 dark:bg-gray-900/40 sm:px-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-gray-600 dark:text-gray-300">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {recommendationRecord.clientName || "Record"}
                    </span>
                    <span className="tabular-nums text-gray-500 dark:text-gray-400">
                      Session #{recommendationRecord.sessionNumber ?? "—"}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">{formatDate(recommendationRecord.date)}</span>
                </div>
                  <p className="mt-1.5 truncate text-gray-500 dark:text-gray-400">
                    Counselor · <span className="font-medium text-gray-700 dark:text-gray-300">{recommendationRecord.counselor || "—"}</span>
                  </p>
                </div>
                </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                <label htmlFor="admin-recommendation-text" className={labelClass}>
                  Recommendation text
                  </label>
                <textarea
                  id="admin-recommendation-text"
                  value={recommendationDraft}
                  onChange={(e) => {
                    setRecommendationDraft(e.target.value);
                    setRecommendationError(null);
                  }}
                  placeholder="Guidance for the counselor (optional sections, bullet points, or next steps)…"
                  disabled={recommendationSaving}
                  rows={8}
                  className={recommendationTextareaClass}
                />
                {recommendationError && (
                  <p className="mt-3 rounded-lg border border-red-200/90 bg-red-50/90 px-3 py-2 text-sm text-red-800 dark:border-red-800/80 dark:bg-red-950/30 dark:text-red-300">
                    {recommendationError}
                  </p>
                )}
                </div>

              <div className="shrink-0 flex flex-wrap justify-end gap-2 border-t border-gray-200 bg-gray-50/80 px-5 py-4 dark:border-gray-600 dark:bg-gray-900/30 sm:px-6">
                      <button
                  type="button"
                  disabled={recommendationSaving}
                  onClick={closeRecommendationModal}
                  className="h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/80"
                >
                  Cancel
                </button>
                    <button
                  type="button"
                  disabled={recommendationSaving}
                  onClick={saveRecommendation}
                  className="h-10 rounded-xl bg-gray-900 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                >
                  {recommendationSaving ? "Saving…" : "Save recommendation"}
                    </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


