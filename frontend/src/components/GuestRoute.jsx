import { Navigate } from "react-router-dom";

/**
 * For landing, login, signup, admin login - redirects away if already authenticated.
 * - If admin logged in -> redirect to admin dashboard
 * - If user logged in -> redirect to user dashboard
 */
export default function GuestRoute({ children }) {
  const adminToken = localStorage.getItem("adminToken");
  const authToken = localStorage.getItem("token") || localStorage.getItem("authToken");

  if (adminToken) {
    return <Navigate to="/admindashboard" replace />;
  }

  if (authToken) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
