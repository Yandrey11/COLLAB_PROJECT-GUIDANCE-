import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import AboutUs from "./pages/AboutUs";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import SetPassword from "./pages/SetPassword";
import Dashboard from "./pages/Dashboard";

import ProtectedAdminRoute from "./components/ProtectedAdminRoute";
import ProtectedUserRoute from "./components/ProtectedUserRoute";
import GuestRoute from "./components/GuestRoute";

import AdminLogin from "./pages/Admin/AdminLogin";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import AdminSignup from "./pages/Admin/AdminSignup";
import UserManagement from "./pages/Admin/UserManagement";
import AdminNotificationCenter from "./pages/Admin/NotificationCenter";
import AdminRecordManagement from "./pages/Admin/AdminRecordManagement";
import AdminProfilePage from "./pages/Admin/AdminProfilePage";
import AdminSettingsPage from "./pages/Admin/AdminSettingsPage";
import BackupRestore from "./pages/Admin/BackupRestore";
import Analytics from "./pages/Admin/Analytics";
import AdminReports from "./pages/Admin/AdminReports";

import RecordsPage from "./pages/RecordsPage";
import ReportsPage from "./pages/ReportsPage";
import NotificationCenter from "./pages/NotificationCenter";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import RouteLoadingBar from "./components/RouteLoadingBar";
import "./App.css";

function App() {
  return (
    <Router>
      <RouteLoadingBar />
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
        <Route path="/reports" element={<ProtectedUserRoute><ReportsPage /></ProtectedUserRoute>} />
        <Route path="/notifications" element={<ProtectedUserRoute><NotificationCenter /></ProtectedUserRoute>} />
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
        <Route path="/admin/records" element={<ProtectedAdminRoute><AdminRecordManagement /></ProtectedAdminRoute>} />
        <Route path="/admin/backups" element={<ProtectedAdminRoute><BackupRestore /></ProtectedAdminRoute>} />
        <Route path="/admin/analytics" element={<ProtectedAdminRoute><Analytics /></ProtectedAdminRoute>} />
        <Route path="/admin/reports" element={<ProtectedAdminRoute><AdminReports /></ProtectedAdminRoute>} />
        <Route path="/admin/profile" element={<ProtectedAdminRoute><AdminProfilePage /></ProtectedAdminRoute>} />
        <Route path="/admin/settings" element={<ProtectedAdminRoute><AdminSettingsPage /></ProtectedAdminRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
