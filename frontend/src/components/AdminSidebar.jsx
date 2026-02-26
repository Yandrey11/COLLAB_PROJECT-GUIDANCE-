import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { initializeTheme } from "../utils/themeUtils";

export default function AdminSidebar() {
  const navigate = useNavigate();

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme();
  }, []);

  const handleLogout = useCallback(async () => {
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
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const navItems = [
    { label: "Dashboard", action: () => navigate("/admindashboard") },
    { label: "User Management", action: () => navigate("/admin/users") },
    { label: "Notification Center", action: () => navigate("/admin/notifications") },
    { label: "Record Management", action: () => navigate("/admin/records") },
    { label: "Reports", action: () => navigate("/admin/reports") },
    { label: "Backup & Restore", action: () => navigate("/admin/backups") },
    { label: "Profile", action: () => navigate("/admin/profile") },
  ];

  return (
    <aside className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm h-fit lg:sticky lg:top-6">
      <h2 className="m-0 text-xl font-bold text-indigo-600 dark:text-indigo-400">Admin Panel</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
        Manage users, view analytics, monitor system activity, and configure settings.
      </p>

      <div className="flex flex-col gap-3 mt-6">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className="p-3 rounded-xl border border-indigo-50 dark:border-gray-700 bg-gradient-to-r from-white to-slate-50 dark:from-gray-800 dark:to-gray-700 hover:from-indigo-50 hover:to-white dark:hover:to-gray-700 hover:shadow-sm text-gray-900 dark:text-gray-100 font-semibold text-left transition-all"
          >
            {item.label}
          </button>
        ))}

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleLogout}
            className="flex-1 p-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
