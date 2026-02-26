import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import AdminSidebar from "../../components/AdminSidebar";
import { initializeTheme } from "../../utils/themeUtils";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function Analytics() {
  useDocumentTitle("Analytics Dashboard");
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  // Summary data
  const [overview, setOverview] = useState({
    totalRecords: 0,
    recordsCreatedInRange: 0,
    totalPDFsGenerated: 0,
    totalDriveUploads: 0,
    activeCounselorsThisWeek: 0,
    totalPageVisits: 0,
    activeUsers: 0,
  });

  // Chart data
  const [dailyRecords, setDailyRecords] = useState([]);
  const [pageVisits, setPageVisits] = useState({ byPage: [], daily: [] });
  const [recordStatusDistribution, setRecordStatusDistribution] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);

  // Filters
  const [dateRange, setDateRange] = useState("30d");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [pageNameFilter, setPageNameFilter] = useState("");

  // Chart refs
  const dailyRecordsChartRef = useRef(null);
  const pageVisitsChartRef = useRef(null);
  const recordStatusChartRef = useRef(null);

  useEffect(() => {
    initializeTheme();
    fetchAdmin();
  }, []);

  useEffect(() => {
    if (admin) {
      fetchAnalyticsData();
    }
  }, [admin, dateRange, eventTypeFilter, pageNameFilter]);

  const fetchAdmin = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) {
        navigate("/adminlogin");
        return;
      }

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

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("adminToken");

      // Fetch overview
      const overviewRes = await axios.get(`${BASE_URL}/api/admin/analytics/overview`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { range: dateRange },
      });
      if (overviewRes.data.success) {
        setOverview(overviewRes.data.overview);
      }

      // Fetch daily records
      const dailyRes = await axios.get(`${BASE_URL}/api/admin/analytics/daily-records`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { range: dateRange },
      });
      if (dailyRes.data.success) {
        setDailyRecords(dailyRes.data.dailyRecords);
      }

      // Fetch page visits
      const pageVisitsRes = await axios.get(`${BASE_URL}/api/admin/analytics/page-visits`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { range: dateRange, pageName: pageNameFilter || undefined },
      });
      if (pageVisitsRes.data.success) {
        setPageVisits(pageVisitsRes.data.pageVisits);
      }

      // Fetch record status distribution
      const statusRes = await axios.get(`${BASE_URL}/api/admin/analytics/record-status-distribution`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (statusRes.data.success) {
        setRecordStatusDistribution(statusRes.data.distribution);
      }

      // Fetch recent events
      const eventsRes = await axios.get(`${BASE_URL}/api/admin/analytics/events`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          range: dateRange,
          eventType: eventTypeFilter || undefined,
          page: 1,
          limit: 10,
        },
      });
      if (eventsRes.data.success) {
        setRecentEvents(eventsRes.data.events);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 font-sans p-4 md:p-8 gap-6">
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        {/* Left: Sidebar */}
        <AdminSidebar />

        {/* Right: Main content */}
        <main className="w-full space-y-6">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 m-0">
                  Analytics Dashboard
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                  System-wide usage analytics and insights
                </p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <div className="flex gap-4 items-center flex-wrap">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Date Range:</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="1y">Last Year</option>
              </select>

              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-4">
                Event Type:
              </label>
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Events</option>
                <option value="record_created">Records Created</option>
                <option value="record_updated">Records Updated</option>
                <option value="pdf_generated">PDFs Generated</option>
                <option value="drive_uploaded">Drive Uploads</option>
                <option value="page_visit">Page Visits</option>
                <option value="user_login">User Logins</option>
              </select>

              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-4">
                Page:
              </label>
              <select
                value={pageNameFilter}
                onChange={(e) => setPageNameFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Pages</option>
                <option value="Dashboard">Dashboard</option>
                <option value="Records Page">Records Page</option>
                <option value="Reports Page">Reports Page</option>
                <option value="Notification Center">Notification Center</option>
                <option value="Settings">Settings</option>
              </select>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title="Total Records"
              value={overview.totalRecords.toLocaleString()}
              icon="📋"
              color="blue"
            />
            <SummaryCard
              title="PDFs Generated"
              value={overview.totalPDFsGenerated.toLocaleString()}
              icon="📄"
              color="green"
            />
            <SummaryCard
              title="Drive Uploads"
              value={overview.totalDriveUploads.toLocaleString()}
              icon="☁️"
              color="purple"
            />
            <SummaryCard
              title="Active Counselors"
              value={overview.activeCounselorsThisWeek.toLocaleString()}
              icon="👥"
              color="orange"
            />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Records Chart */}
            <ChartCard title="Daily Records Created">
              <LineChart data={dailyRecords} />
            </ChartCard>

            {/* Record Status Distribution */}
            <ChartCard title="Record Status Distribution">
              <PieChart data={recordStatusDistribution} />
            </ChartCard>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 gap-6">
            {/* Page Visits Chart */}
            <ChartCard title="Page Visits by Module">
              <BarChart data={pageVisits.byPage} />
            </ChartCard>
          </div>

          {/* Recent Activities Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Recent Activities</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Event
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Page/Module
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {recentEvents.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        No recent activities found
                      </td>
                    </tr>
                  ) : (
                    recentEvents.map((event) => (
                      <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {formatEventType(event.eventType)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-gray-100">
                            {event.userName || "System"}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {event.userRole || "N/A"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {event.pageName || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(event.timestamp)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// Summary Card Component
function SummaryCard({ title, value, icon, color }) {
  const colorClasses = {
    blue: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
    green: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
    purple: "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200",
    orange: "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
}

// Chart Card Component
function ChartCard({ title, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm"
    >
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
      <div className="h-64">{children}</div>
    </motion.div>
  );
}

// Placeholder Chart Components (will be replaced with Chart.js)
function LineChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        No data available
      </div>
    );
  }

  // Simple SVG line chart (will be replaced with Chart.js)
  const maxValue = Math.max(...data.map((d) => d.count), 1);
  const chartHeight = 200;
  const chartWidth = 600;
  const padding = 20;
  const labelHeight = 25; // Space for day labels
  const totalHeight = chartHeight + labelHeight;
  
  // Helper function to get day from date string
  const getDayFromDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.getDate(); // Returns day of month (1-31)
    } catch (e) {
      return "";
    }
  };
  
  const points = data.map((d, i) => {
    const x = ((i / (data.length - 1 || 1)) * (chartWidth - padding * 2) + padding).toFixed(2);
    const y = (chartHeight - (d.count / maxValue) * (chartHeight - padding * 2) - padding).toFixed(2);
    return `${x},${y}`;
  });

  return (
    <div className="h-full flex items-center justify-center">
      <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${totalHeight}`} className="overflow-visible">
        <polyline
          fill="none"
          stroke="#4f46e5"
          strokeWidth="2"
          points={points.join(" ")}
          className="drop-shadow-sm"
        />
        {data.map((d, i) => {
          const x = ((i / (data.length - 1 || 1)) * (chartWidth - padding * 2) + padding).toFixed(2);
          const y = (chartHeight - (d.count / maxValue) * (chartHeight - padding * 2) - padding).toFixed(2);
          const day = getDayFromDate(d.date);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="4" fill="#4f46e5" className="drop-shadow-sm" />
              {/* Day label below the chart */}
              <text
                x={x}
                y={chartHeight + 15}
                textAnchor="middle"
                className="text-xs fill-gray-600 dark:fill-gray-400"
                fontSize="10"
              >
                {day}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function BarChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.count), 1);
  const barWidth = 60;
  const spacing = 20;

  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex items-end gap-4 h-48">
        {data.map((item, i) => {
          const height = (item.count / maxValue) * 180;
          return (
            <div key={i} className="flex flex-col items-center">
              <div
                className="bg-indigo-500 rounded-t w-12 transition-all"
                style={{ height: `${height}px`, minHeight: item.count > 0 ? "4px" : "0" }}
              ></div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 text-center max-w-16 truncate">
                {item.pageName}
              </div>
              <div className="text-xs font-medium text-gray-900 dark:text-gray-100 mt-1">{item.count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PieChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        No data available
      </div>
    );
  }

  const colors = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="h-full flex items-center justify-center">
      <div className="grid grid-cols-2 gap-4">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: colors[i % colors.length] }}
            ></div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.status}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {item.count} ({item.percentage}%)
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper functions
function formatEventType(eventType) {
  return eventType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

