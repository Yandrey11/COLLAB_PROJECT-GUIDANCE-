import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import Swal from "sweetalert2";
import AdminSidebar from "../../components/AdminSidebar";
import { initializeTheme } from "../../utils/themeUtils";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { COUNSELOR_COLLEGES } from "../../constants/counselorColleges";

export default function UserManagement() {
  useDocumentTitle("Admin User Management");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("counselor"); // Default to counselor role
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState({ type: "", text: "" });
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Form states
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    role: "counselor",
    college: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "counselor",
    college: "",
  });
  const [permissionsForm, setPermissionsForm] = useState({
    can_view_records: true,
    can_edit_records: true,
    can_view_reports: true,
    is_admin: false,
  });
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [showActionsColumn, setShowActionsColumn] = useState(true);

  useEffect(() => {
    initializeTheme();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      navigate("/adminlogin", { replace: true });
      return;
    }

    // Verify admin access
    const verifyAdmin = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
        const res = await axios.get(`${baseUrl}/api/admin/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data.role !== "admin") {
          navigate("/adminlogin", { replace: true });
          return;
        }

        // Load initial data - fetch counselors by default
        await fetchUsers(token, 1, "", "counselor", "all");
        setLoading(false);
      } catch (err) {
        console.error("❌ Admin verification failed:", err);
        navigate("/adminlogin", { replace: true });
      }
    };

    verifyAdmin();
  }, [navigate]);

  const fetchUsers = async (token, page = 1, search = "", role = "all", status = "all") => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.get(`${baseUrl}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { page, limit: 10, search, role, status },
      });

      setUsers(res.data.users || []);
      setTotalPages(res.data.totalPages || 1);
      setCurrentPage(res.data.currentPage || 1);
      setMessage({ type: "", text: "" });
    } catch (err) {
      console.error("❌ Error fetching users:", err);
      console.error("Error response:", err.response?.data);
      const errorMessage = err.response?.data?.message || err.message || "Failed to load users";
      setMessage({ type: "error", text: errorMessage });
      setUsers([]);
      setTotalPages(1);
      setCurrentPage(1);
    }
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  const containsNumbers = (value) => /\d/.test(value);


  const handleAddUser = async (e) => {
    e.preventDefault();
    const errors = {};

    // Validation
    if (!addForm.name.trim()) {
      errors.name = "Name is required";
    } else if (containsNumbers(addForm.name)) {
      errors.name = "Name cannot contain numbers";
    }
    if (!addForm.email.trim()) {
      errors.email = "Email is required";
    } else if (!validateEmail(addForm.email)) {
      errors.email = "Invalid email format";
    }
    if (addForm.role === "counselor" && !addForm.college) {
      errors.college = "College is required for counselors";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      const token = localStorage.getItem("adminToken");
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/admin/users`,
        addForm,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setMessage({ type: "success", text: res.data.message || "User created successfully. Password setup link has been sent to their email." });
      setShowAddModal(false);
      setAddForm({ name: "", email: "", role: "counselor", college: "" });
      setFormErrors({});
      await fetchUsers(token, currentPage, searchQuery, roleFilter, statusFilter);
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (err) {
      console.error("❌ Error creating user:", err);
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to create user",
      });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    const errors = {};

    // Validation
    if (!editForm.name.trim()) {
      errors.name = "Name is required";
    } else if (containsNumbers(editForm.name)) {
      errors.name = "Name cannot contain numbers";
    }
    if (!editForm.email.trim()) {
      errors.email = "Email is required";
    } else if (!validateEmail(editForm.email)) {
      errors.email = "Invalid email format";
    }
    if (
      selectedUser?.userType === "regular" &&
      editForm.role === "counselor" &&
      !editForm.college
    ) {
      errors.college = "College is required for counselor accounts";
    }
    if (
      selectedUser?.userType === "admin" &&
      editForm.role === "counselor" &&
      !editForm.college
    ) {
      errors.college = "College is required when changing role to counselor";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      const token = localStorage.getItem("adminToken");
      const res = await axios.put(
        `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/admin/users/${selectedUser.id}`,
        editForm,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setMessage({ type: "success", text: "User updated successfully" });
      setShowEditModal(false);
      setSelectedUser(null);
      setFormErrors({});
      await fetchUsers(token, currentPage, searchQuery, roleFilter, statusFilter);
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (err) {
      console.error("❌ Error updating user:", err);
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to update user",
      });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    }
  };


  const handleDeleteUser = async (userId, email) => {
    const result = await Swal.fire({
      title: "Delete User?",
      html: `Are you sure you want to permanently delete <strong>${email}</strong>?<br>This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const token = localStorage.getItem("adminToken");
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      await axios.delete(`${baseUrl}/api/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMessage({ type: "success", text: "User deleted successfully" });
      await fetchUsers(token, currentPage, searchQuery, roleFilter, statusFilter);
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (err) {
      console.error("❌ Error deleting user:", err);
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to delete user",
      });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      college: user.college || "",
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const openPermissionsModal = async (user) => {
    setSelectedUser(user);
    setLoadingPermissions(true);
    setFormErrors({});
    
    try {
      const token = localStorage.getItem("adminToken");
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.get(`${baseUrl}/api/admin/users/${user.id}/permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setPermissionsForm({
        can_view_records: res.data.permissions?.can_view_records ?? true,
        can_edit_records: res.data.permissions?.can_edit_records ?? true,
        can_view_reports: res.data.permissions?.can_view_reports ?? true,
        is_admin: res.data.permissions?.is_admin ?? false,
      });
      
      setShowPermissionsModal(true);
    } catch (err) {
      console.error("❌ Error fetching user permissions:", err);
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to load user permissions",
      });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } finally {
      setLoadingPermissions(false);
    }
  };

  const handleUpdatePermissions = async (e) => {
    e.preventDefault();
    
    if (!selectedUser) return;

    // Check if removing critical permissions
    const removingRecordsAccess = 
      permissionsForm.can_view_records === false && selectedUser.permissions?.can_view_records !== false;
    const removingReportsAccess = 
      permissionsForm.can_view_reports === false && selectedUser.permissions?.can_view_reports !== false;

    if (removingRecordsAccess || removingReportsAccess) {
      const confirmMessage = `Are you sure you want to remove ${removingRecordsAccess && removingReportsAccess ? "Records and Reports" : removingRecordsAccess ? "Records" : "Reports"} access from ${selectedUser.name}?`;
      
      const result = await Swal.fire({
        title: "Confirm Permission Removal",
        html: confirmMessage,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        cancelButtonColor: "#6b7280",
        confirmButtonText: "Yes, remove access",
        cancelButtonText: "Cancel",
      });

      if (!result.isConfirmed) {
        return;
      }
    }

    try {
      const token = localStorage.getItem("adminToken");
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      
      const res = await axios.put(
        `${baseUrl}/api/admin/users/${selectedUser.id}/permissions`,
        { permissions: permissionsForm },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setMessage({ 
        type: "success", 
        text: res.data.message || "Permissions updated successfully" 
      });
      setShowPermissionsModal(false);
      setSelectedUser(null);
      setFormErrors({});
      await fetchUsers(token, currentPage, searchQuery, roleFilter, statusFilter);
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    } catch (err) {
      console.error("❌ Error updating permissions:", err);
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to update permissions",
      });
      setTimeout(() => setMessage({ type: "", text: "" }), 3000);
    }
  };

  const handleSendResetLink = async (user) => {
    const result = await Swal.fire({
      title: "Send Reset Link?",
      text: `Send password reset link to ${user.email}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#4f46e5",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, send link",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const token = localStorage.getItem("adminToken");
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/admin/users/${user.id}/reset-password`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setMessage({
        type: "success",
        text: res.data.message || "Password reset link has been sent to the user's email.",
      });
      setTimeout(() => setMessage({ type: "", text: "" }), 5000);
    } catch (err) {
      console.error("❌ Error sending reset link:", err);
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to send password reset link",
      });
      setTimeout(() => setMessage({ type: "", text: "" }), 5000);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("adminToken");
    await fetchUsers(token, 1, searchQuery, roleFilter, statusFilter);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const cardSurface =
    "rounded-2xl border border-gray-200/90 bg-white shadow-sm dark:border-gray-700/90 dark:bg-gray-800/80";
  const labelClass =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500";
  const inputClass =
    "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm transition-all placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400";
  const selectClass = `${inputClass} cursor-pointer`;
  const permPill =
    "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium";
  const actionBtn =
    "inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/80";

  if (loading) {
  return (
      <div className="flex min-h-screen w-full items-center justify-center page-bg counselor-typography font-sans">
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-600 dark:border-gray-600 dark:border-t-indigo-400"
            aria-hidden
          />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading users…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full page-bg counselor-typography font-sans text-gray-900 dark:text-gray-100">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="flex flex-col gap-8">
          <motion.header
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6 border-b border-gray-200/80 pb-8 dark:border-gray-700/80 sm:flex-row sm:items-start sm:justify-between sm:pb-10"
          >
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <AdminSidebar variant="header" />
              <div className="hidden h-10 w-px shrink-0 bg-gray-200 dark:bg-gray-700 sm:block" aria-hidden />
              <div className="min-w-0 space-y-2">
                <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                  Administration
                </p>
                <h1 className="m-0 text-2xl font-semibold tracking-tight sm:text-3xl">User management</h1>
                <p className="m-0 max-w-xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  Search accounts, adjust roles and colleges, permissions, and account lifecycle.
                </p>
              </div>
              </div>
              <button
              type="button"
                onClick={() => {
                  setShowAddModal(true);
                setAddForm({ name: "", email: "", role: "counselor", college: "" });
                  setFormErrors({});
                }}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-gray-900 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white sm:self-center"
              >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add user
              </button>
          </motion.header>

        {message.text && (
          <div
              role="status"
              className={`rounded-xl border px-4 py-3 text-sm font-medium ${
              message.type === "success"
                  ? "border-green-200/90 bg-green-50/90 text-green-800 dark:border-green-800/80 dark:bg-green-950/30 dark:text-green-300"
                  : "border-red-200/90 bg-red-50/90 text-red-800 dark:border-red-800/80 dark:bg-red-950/30 dark:text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}

          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className={`${cardSurface} p-5 sm:p-6`}
          >
            <div className="mb-5">
              <h2 className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">Search & filters</h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Narrow the directory, then run search.</p>
            </div>
            <form onSubmit={handleSearch} className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
              <div className="min-w-0 flex-1 lg:min-w-[240px]">
                <label htmlFor="user-mgmt-search" className={labelClass}>
                  Search
                </label>
              <input
                  id="user-mgmt-search"
                type="text"
                  placeholder="Name or email…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                  className={inputClass}
              />
              </div>
              <div className="w-full sm:w-[200px]">
                <label htmlFor="user-mgmt-role" className={labelClass}>
                  Role
                </label>
              <select
                  id="user-mgmt-role"
                value={roleFilter}
                onChange={(e) => {
                  const newRole = e.target.value;
                  setRoleFilter(newRole);
                  const token = localStorage.getItem("adminToken");
                  fetchUsers(token, 1, searchQuery, newRole, statusFilter);
                }}
                  className={selectClass}
              >
                  <option value="all">All roles</option>
                <option value="admin">Admin</option>
                <option value="counselor">Counselor</option>
              </select>
              </div>
              <div className="w-full sm:w-[200px]">
                <label htmlFor="user-mgmt-status" className={labelClass}>
                  Status
                </label>
              <select
                  id="user-mgmt-status"
                value={statusFilter}
                onChange={(e) => {
                  const newStatus = e.target.value;
                  setStatusFilter(newStatus);
                  const token = localStorage.getItem("adminToken");
                  fetchUsers(token, 1, searchQuery, roleFilter, newStatus);
                }}
                  className={selectClass}
              >
                  <option value="all">All status</option>
                  <option value="active">Active (online)</option>
                <option value="offline">Offline</option>
              </select>
              </div>
              <div className="flex flex-wrap gap-2 pt-1 lg:ml-auto">
              <button
                type="submit"
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-gray-900 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => {
                  const token = localStorage.getItem("adminToken");
                  setSearchQuery("");
                  setRoleFilter("counselor");
                  setStatusFilter("all");
                  fetchUsers(token, 1, "", "counselor", "all");
                }}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
              >
                Reset
              </button>
          </div>
            </form>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className={`overflow-hidden ${cardSurface}`}
          >
            <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-600 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">Directory</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {users.length === 1 ? "1 user on this page" : `${users.length} users on this page`}
                </p>
              </div>
              {!showActionsColumn && (
                <button
                  type="button"
                  onClick={() => setShowActionsColumn(true)}
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-xs font-medium text-gray-800 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
                  title="Show actions column"
                >
                  <svg className="h-4 w-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                  Show row actions
                </button>
              )}
            </div>

          {users.length === 0 ? (
              <div className="px-5 py-16 text-center text-sm text-gray-500 dark:text-gray-400 sm:px-6">
                No users match your filters.
            </div>
          ) : (
            <>
                <div className="px-2 pb-2 pt-0 sm:px-4 sm:pb-6">
                  <div className="-mx-2 overflow-x-auto sm:mx-0">
                    <table className="w-full min-w-[960px] border-collapse text-left text-sm text-gray-900 dark:text-gray-100">
                  <thead>
                        <tr className="border-b border-gray-200 bg-gray-50/80 dark:border-gray-600 dark:bg-gray-900/20">
                          <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Name
                      </th>
                          <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Email
                      </th>
                          <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Role
                      </th>
                          <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            College
                      </th>
                          <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Status
                      </th>
                          <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Created
                          </th>
                          <th className="min-w-[8rem] px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Access
                      </th>
                      {showActionsColumn && (
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              <div className="flex items-center justify-end gap-2">
                                <span>Actions</span>
                            <button
                                  type="button"
                              onClick={() => setShowActionsColumn(false)}
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
                        {users.map((user) => (
                          <tr
                            key={user.id}
                            className="border-b border-gray-200 transition-colors last:border-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
                          >
                            <td className="whitespace-nowrap px-4 py-3.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {user.name}
                          </td>
                            <td className="max-w-[14rem] truncate px-4 py-3.5 text-sm text-gray-600 dark:text-gray-300">
                              {user.email}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5">
                            <span
                                className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize ${
                                user.role === "admin"
                                    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                                    : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                              }`}
                            >
                              {user.role === "admin" ? "Admin" : "Counselor"}
                            </span>
                          </td>
                            <td className="max-w-[12rem] truncate px-4 py-3.5 text-xs text-gray-600 dark:text-gray-300">
                              {user.role === "admin" ? "—" : user.college || "—"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3.5">
                            <span
                                className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                                user.isOnline
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                    : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                              }`}
                            >
                                {user.isOnline ? "Online" : "Offline"}
                            </span>
                          </td>
                            <td className="whitespace-nowrap px-4 py-3.5 text-sm text-gray-600 dark:text-gray-300">
                            {formatDate(user.createdAt)}
                          </td>
                            <td className="px-4 py-3.5 align-top">
                              <div className="flex max-w-[220px] flex-wrap gap-1.5">
                              {user.role === "admin" ? (
                                <span
                                    className={`${permPill} border-purple-200/80 bg-purple-50 text-purple-800 dark:border-purple-800/60 dark:bg-purple-950/40 dark:text-purple-300`}
                                    title="Full access"
                                >
                                  Admin
                                </span>
                              ) : (
                                <>
                                  {user.permissions?.can_view_records !== false && (
                                    <span
                                        className={`${permPill} border-green-200/80 bg-green-50 text-green-800 dark:border-green-800/60 dark:bg-green-950/40 dark:text-green-300`}
                                        title="Records"
                                    >
                                      Records
                                    </span>
                                  )}
                                  {user.permissions?.can_edit_records && (
                                    <span
                                        className={`${permPill} border-sky-200/80 bg-sky-50 text-sky-900 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300`}
                                        title="Edit"
                                    >
                                      Edit
                                    </span>
                                  )}
                                  {user.permissions?.can_view_reports !== false && (
                                    <span
                                        className={`${permPill} border-indigo-200/80 bg-indigo-50 text-indigo-900 dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-300`}
                                        title="Reports"
                                    >
                                      Reports
                                    </span>
                                  )}
                                  {(user.permissions?.can_view_records === false || 
                                    user.permissions?.can_view_reports === false) && (
                                    <span
                                        className={`${permPill} border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200`}
                                        title="Limited access"
                                    >
                                        Limited
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                          {showActionsColumn && (
                              <td className="whitespace-nowrap px-4 py-3.5 text-right">
                                <div className="flex flex-wrap items-center justify-end gap-1.5">
                                  <button type="button" onClick={() => openEditModal(user)} className={actionBtn} title="Edit">
                                  Edit
                                </button>
                                {user.role !== "admin" && (
                                  <button
                                      type="button"
                                    onClick={() => openPermissionsModal(user)}
                                      className={actionBtn}
                                      title="Manage permissions"
                                  >
                                    Permissions
                                  </button>
                                )}
                                  <button type="button" onClick={() => handleSendResetLink(user)} className={actionBtn} title="Reset password">
                                  Reset
                                </button>
                                <button
                                    type="button"
                                  onClick={() => handleDeleteUser(user.id, user.email)}
                                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-medium text-red-800 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60"
                                  title="Delete user"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                        ))}
                  </tbody>
                </table>
                  </div>
              </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-600 sm:px-6">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Page {currentPage} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                  <button
                        type="button"
                    onClick={() => {
                      const token = localStorage.getItem("adminToken");
                      if (currentPage > 1) {
                        fetchUsers(token, currentPage - 1, searchQuery, roleFilter, statusFilter);
                      }
                    }}
                    disabled={currentPage <= 1}
                        className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
                      >
                        Previous
                  </button>
                  <button
                        type="button"
                    onClick={() => {
                      const token = localStorage.getItem("adminToken");
                      if (currentPage < totalPages) {
                        fetchUsers(token, currentPage + 1, searchQuery, roleFilter, statusFilter);
                      }
                    }}
                    disabled={currentPage >= totalPages}
                        className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700/80"
                  >
                    Next
                  </button>
                </div>
              </div>
                )}
            </>
          )}
          </motion.section>
        </div>
      </div>

      <AnimatePresence>
      {showAddModal && (
          <motion.div
            key="add-user-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-[2px]"
          onClick={() => {
            setShowAddModal(false);
            setFormErrors({});
          }}
        >
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
              className="max-h-[min(90vh,720px)] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="border-b border-gray-200 px-6 py-5 dark:border-gray-600">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">New account</p>
                <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">Add user</h2>
              </div>
              <form onSubmit={handleAddUser} className="space-y-5 px-6 py-6">
                <div>
                  <label htmlFor="add-name" className={labelClass}>
                    Full name <span className="text-red-500">*</span>
                </label>
                <input
                    id="add-name"
                  type="text"
                  value={addForm.name}
                    onChange={(e) =>
                      setAddForm({
                        ...addForm,
                        name: e.target.value.replace(/[0-9]/g, ""),
                      })
                    }
                    className={`${inputClass} ${formErrors.name ? "border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500" : ""}`}
                  />
                  {formErrors.name && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{formErrors.name}</p>}
              </div>
                <div>
                  <label htmlFor="add-email" className={labelClass}>
                    Email <span className="text-red-500">*</span>
                </label>
                <input
                    id="add-email"
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    className={`${inputClass} ${formErrors.email ? "border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500" : ""}`}
                  />
                  {formErrors.email && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{formErrors.email}</p>}
                  <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                    A password setup link is emailed to this address.
                </p>
              </div>
                <div>
                  <label htmlFor="add-role" className={labelClass}>
                    Role <span className="text-red-500">*</span>
                </label>
                <select
                    id="add-role"
                  value={addForm.role}
                    onChange={(e) =>
                      setAddForm({
                        ...addForm,
                        role: e.target.value,
                        college: e.target.value === "admin" ? "" : addForm.college,
                      })
                    }
                    className={selectClass}
                >
                  <option value="counselor">Counselor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
                {addForm.role === "counselor" && (
                  <div>
                    <label htmlFor="add-college" className={labelClass}>
                      College <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="add-college"
                      value={addForm.college}
                      onChange={(e) => setAddForm({ ...addForm, college: e.target.value })}
                      className={`${selectClass} ${formErrors.college ? "border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500" : ""}`}
                    >
                      <option value="">Select college</option>
                      {COUNSELOR_COLLEGES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {formErrors.college && (
                      <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{formErrors.college}</p>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 pt-5 dark:border-gray-600">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setFormErrors({});
                  }}
                    className="h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/80"
                >
                  Cancel
                </button>
                  <button
                    type="submit"
                    className="h-10 rounded-xl bg-gray-900 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                  >
                    Create user
                  </button>
              </div>
            </form>
            </motion.div>
          </motion.div>
      )}

      {showEditModal && selectedUser && (
          <motion.div
            key="edit-user-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-[2px]"
          onClick={() => {
            setShowEditModal(false);
            setFormErrors({});
          }}
        >
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
              className="max-h-[min(90vh,720px)] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="border-b border-gray-200 px-6 py-5 dark:border-gray-600">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Edit account</p>
                <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">{selectedUser.name}</h2>
              </div>
              <form onSubmit={handleEditUser} className="space-y-5 px-6 py-6">
                <div>
                  <label htmlFor="edit-name" className={labelClass}>
                    Full name <span className="text-red-500">*</span>
                </label>
                <input
                    id="edit-name"
                  type="text"
                  value={editForm.name}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        name: e.target.value.replace(/[0-9]/g, ""),
                      })
                    }
                    className={`${inputClass} ${formErrors.name ? "border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500" : ""}`}
                  />
                  {formErrors.name && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{formErrors.name}</p>}
              </div>
                <div>
                  <label htmlFor="edit-email" className={labelClass}>
                    Email <span className="text-red-500">*</span>
                </label>
                <input
                    id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className={`${inputClass} ${formErrors.email ? "border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500" : ""}`}
                  />
                  {formErrors.email && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{formErrors.email}</p>}
              </div>
                <div>
                  <label htmlFor="edit-role" className={labelClass}>
                    Role <span className="text-red-500">*</span>
                </label>
                <select
                    id="edit-role"
                  value={editForm.role}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        role: e.target.value,
                        college: e.target.value === "admin" ? "" : editForm.college,
                      })
                    }
                    className={selectClass}
                >
                  <option value="counselor">Counselor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
                {editForm.role === "counselor" && (
                  <div>
                    <label htmlFor="edit-college" className={labelClass}>
                      College <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="edit-college"
                      value={editForm.college}
                      onChange={(e) => setEditForm({ ...editForm, college: e.target.value })}
                      className={`${selectClass} ${formErrors.college ? "border-red-500 focus:border-red-500 focus:ring-red-500 dark:border-red-500" : ""}`}
                    >
                      <option value="">Select college</option>
                      {COUNSELOR_COLLEGES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {formErrors.college && (
                      <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{formErrors.college}</p>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 pt-5 dark:border-gray-600">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setFormErrors({});
                  }}
                    className="h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/80"
                >
                  Cancel
                </button>
                  <button
                    type="submit"
                    className="h-10 rounded-xl bg-gray-900 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                  >
                    Save changes
                  </button>
              </div>
            </form>
            </motion.div>
          </motion.div>
      )}

      {showPermissionsModal && selectedUser && (
          <motion.div
            key="perms-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-[2px]"
          onClick={() => {
            setShowPermissionsModal(false);
            setFormErrors({});
          }}
        >
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
              className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="border-b border-gray-200 px-6 py-5 dark:border-gray-600">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Access</p>
                <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                  Permissions · {selectedUser.name}
            </h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  Changes apply as soon as you save.
            </p>
              </div>

            {loadingPermissions ? (
                <div className="px-6 py-16 text-center text-sm text-gray-500 dark:text-gray-400">Loading permissions…</div>
              ) : (
                <form onSubmit={handleUpdatePermissions} className="px-6 py-6">
                  <div className="space-y-3">
                    <label className="flex cursor-pointer gap-3 rounded-xl border border-gray-200 p-4 transition hover:bg-gray-50/80 dark:border-gray-600 dark:hover:bg-gray-900/30">
                      <input
                        type="checkbox"
                        checked={permissionsForm.can_view_records}
                        onChange={(e) =>
                          setPermissionsForm({
                            ...permissionsForm,
                            can_view_records: e.target.checked,
                            can_edit_records: e.target.checked ? permissionsForm.can_edit_records : false,
                          })
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Records page</p>
                        <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                          View the Records page and browse session records.
                        </p>
                      </div>
                    </label>

                    <label
                      className={`ml-1 flex gap-3 rounded-xl border p-4 dark:border-gray-600 ${
                        permissionsForm.can_view_records
                          ? "cursor-pointer border-gray-200 hover:bg-gray-50/80 dark:hover:bg-gray-900/30"
                          : "cursor-not-allowed border-gray-100 opacity-50 dark:border-gray-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={permissionsForm.can_edit_records}
                        disabled={!permissionsForm.can_view_records}
                        onChange={(e) =>
                          setPermissionsForm({
                            ...permissionsForm,
                            can_edit_records: e.target.checked,
                          })
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed"
                      />
                      <div className="min-w-0 pl-2 sm:border-l sm:border-gray-200 sm:pl-4 dark:sm:border-gray-600">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Edit records</p>
                        <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                          Create, update, and delete session records.
                        </p>
                      </div>
                    </label>

                    <label className="flex cursor-pointer gap-3 rounded-xl border border-gray-200 p-4 transition hover:bg-gray-50/80 dark:border-gray-600 dark:hover:bg-gray-900/30">
                      <input
                        type="checkbox"
                        checked={permissionsForm.can_view_reports}
                        onChange={(e) =>
                          setPermissionsForm({
                            ...permissionsForm,
                            can_view_reports: e.target.checked,
                          })
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Reports page</p>
                        <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                          View reports and generated outputs.
                        </p>
                      </div>
                    </label>
                  </div>

                  <div className="mt-8 flex flex-wrap justify-end gap-2 border-t border-gray-200 pt-5 dark:border-gray-600">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPermissionsModal(false);
                      setFormErrors({});
                    }}
                      className="h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700/80"
                  >
                    Cancel
                  </button>
                    <button
                      type="submit"
                      className="h-10 rounded-xl bg-gray-900 px-4 text-sm font-medium text-white transition-colors hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                    >
                      Save permissions
                    </button>
                </div>
              </form>
            )}
            </motion.div>
          </motion.div>
      )}
      </AnimatePresence>

    </div>
  );
}
