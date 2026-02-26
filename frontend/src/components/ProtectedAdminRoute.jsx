import { Navigate, useLocation } from "react-router-dom";

/**
 * Protects admin routes - redirects to admin login if not authenticated.
 * Allows access when token is in URL (e.g. Google OAuth redirect).
 */
export default function ProtectedAdminRoute({ children }) {
  const adminToken = localStorage.getItem("adminToken");
  const location = useLocation();
  const search = typeof location?.search === "string" ? location.search : window.location.search || "";
  const tokenFromUrl = new URLSearchParams(search).get("token");

  // Allow access if token in localStorage OR in URL (Google OAuth redirect)
  if (!adminToken && !tokenFromUrl) {
    return <Navigate to="/adminlogin" state={{ from: location }} replace />;
  }

  return children;
}
