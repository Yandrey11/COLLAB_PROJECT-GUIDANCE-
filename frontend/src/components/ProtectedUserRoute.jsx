import { Navigate, useLocation } from "react-router-dom";

/**
 * Protects user/counselor routes - redirects to login if not authenticated.
 * Allows access when token is in URL (e.g. Google OAuth redirect).
 */
export default function ProtectedUserRoute({ children }) {
  const authToken = localStorage.getItem("token") || localStorage.getItem("authToken");
  const location = useLocation();
  const search = typeof location?.search === "string" ? location.search : window.location.search || "";
  const tokenFromUrl = new URLSearchParams(search).get("token");

  // Allow access if token in localStorage OR in URL (OAuth redirect)
  if (!authToken && !tokenFromUrl) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
