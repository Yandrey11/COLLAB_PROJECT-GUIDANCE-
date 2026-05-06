import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import ProtectedUserRoute from "./components/ProtectedUserRoute";
import GuestRoute from "./components/GuestRoute";

import "./App.css";

// Eagerly load entry/critical pages so first paint is fast.
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import AdminLogin from "./pages/Admin/AdminLogin";

// Lazy-load everything else — split per-route, downloaded on demand.
const AboutUs = lazy(() => import("./pages/AboutUs"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const SetPassword = lazy(() => import("./pages/SetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const RecordsPage = lazy(() => import("./pages/RecordsPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const NotificationCenter = lazy(() => import("./pages/NotificationCenter"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

const AdminDashboard = lazy(() => import("./pages/Admin/AdminDashboard"));
const AdminSignup = lazy(() => import("./pages/Admin/AdminSignup"));
const UserManagement = lazy(() => import("./pages/Admin/UserManagement"));
const AdminNotificationCenter = lazy(() => import("./pages/Admin/NotificationCenter"));
const AdminRecordManagement = lazy(() => import("./pages/Admin/AdminRecordManagement"));
const AdminProfilePage = lazy(() => import("./pages/Admin/AdminProfilePage"));
const AdminSettingsPage = lazy(() => import("./pages/Admin/AdminSettingsPage"));
const BackupRestore = lazy(() => import("./pages/Admin/BackupRestore"));
const Analytics = lazy(() => import("./pages/Admin/Analytics"));
const AdminReports = lazy(() => import("./pages/Admin/AdminReports"));
const AdminMessages = lazy(() => import("./pages/Admin/AdminMessages"));

// Minimal silent fallback — keeps the screen stable while a route chunk loads.
function RouteFallback() {
  return (
    <div className="page-bg min-h-screen w-full" aria-busy="true" aria-live="polite" />
  );
}

function App() {
  return (
    <Router>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Guest routes - redirect to dashboard if already logged in */}
          <Route path="/" element={<GuestRoute><Landing /></GuestRoute>} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />
          <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
          <Route path="/reset-password" element={<GuestRoute><ResetPassword /></GuestRoute>} />
          <Route path="/set-password" element={<GuestRoute><SetPassword /></GuestRoute>} />

          {/* User routes - require auth token */}
          <Route path="/dashboard" element={<ProtectedUserRoute><Dashboard /></ProtectedUserRoute>} />
          <Route path="/records" element={<ProtectedUserRoute><RecordsPage /></ProtectedUserRoute>} />
          <Route path="/records/archive" element={<ProtectedUserRoute><RecordsPage archivedView /></ProtectedUserRoute>} />
          <Route path="/reports" element={<ProtectedUserRoute><ReportsPage /></ProtectedUserRoute>} />
          <Route path="/notifications" element={<ProtectedUserRoute><NotificationCenter /></ProtectedUserRoute>} />
          <Route path="/messages" element={<ProtectedUserRoute><MessagesPage /></ProtectedUserRoute>} />
          <Route path="/profile" element={<ProtectedUserRoute><ProfilePage /></ProtectedUserRoute>} />
          <Route path="/settings" element={<ProtectedUserRoute><SettingsPage /></ProtectedUserRoute>} />

          {/* Admin guest routes - redirect to admin dashboard if admin logged in */}
          <Route path="/adminlogin" element={<GuestRoute><AdminLogin /></GuestRoute>} />
          <Route path="/AdminLogin" element={<Navigate to="/adminlogin" replace />} />
          <Route path="/adminsignup" element={<GuestRoute><AdminSignup /></GuestRoute>} />

          {/* Admin protected routes - require admin token */}
          <Route path="/admindashboard" element={<ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>} />
          <Route path="/AdminDashboard" element={<Navigate to="/admindashboard" replace />} />
          <Route path="/admin/users" element={<ProtectedAdminRoute><UserManagement /></ProtectedAdminRoute>} />
          <Route path="/admin/notifications" element={<ProtectedAdminRoute><AdminNotificationCenter /></ProtectedAdminRoute>} />
          <Route path="/admin/messages" element={<ProtectedAdminRoute><AdminMessages /></ProtectedAdminRoute>} />
          <Route path="/admin/records" element={<ProtectedAdminRoute><AdminRecordManagement /></ProtectedAdminRoute>} />
          <Route path="/admin/backups" element={<ProtectedAdminRoute><BackupRestore /></ProtectedAdminRoute>} />
          <Route path="/admin/analytics" element={<ProtectedAdminRoute><Analytics /></ProtectedAdminRoute>} />
          <Route path="/admin/reports" element={<ProtectedAdminRoute><AdminReports /></ProtectedAdminRoute>} />
          <Route path="/admin/profile" element={<ProtectedAdminRoute><AdminProfilePage /></ProtectedAdminRoute>} />
          <Route path="/admin/settings" element={<ProtectedAdminRoute><AdminSettingsPage /></ProtectedAdminRoute>} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
