import { Navigate, useLocation } from "react-router-dom";

/**
 * For landing, login, signup, admin login - redirects away if already authenticated.
 * - If admin logged in -> redirect to admin dashboard
 * - If user logged in -> redirect to user dashboard
 */
export default function GuestRoute({ children }) {
  const location = useLocation();
  const adminToken = localStorage.getItem("adminToken");
  const authToken = localStorage.getItem("token") || localStorage.getItem("authToken");

  // Allow token-based password setup/reset links even when an admin/user is logged in.
  // This supports opening invitation/reset links from the same browser session.
  const searchParams = new URLSearchParams(location.search);
  const hasTokenAndEmail = Boolean(searchParams.get("token") && searchParams.get("email"));
  const isPasswordLink = location.pathname === "/set-password" || location.pathname === "/reset-password";

  if (isPasswordLink && hasTokenAndEmail) {
    return children;
  }

  if (adminToken) {
    return <Navigate to="/admindashboard" replace />;
  }

  if (authToken) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
