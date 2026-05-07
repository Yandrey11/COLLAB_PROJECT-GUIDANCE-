import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import axios from "axios";
import { API_BASE_URL } from "../config/apiBaseUrl";

const BASE_URL = API_BASE_URL;

// Inactivity timeout: 1 hour (60 minutes = 3600000 milliseconds)
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000;

// Check interval: every 5 minutes
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Custom hook to detect user inactivity and automatically logout after 1 hour
 * @param {Object} options - Configuration options
 * @param {Function} options.onLogout - Callback function called when user is logged out
 * @param {boolean} options.enabled - Whether inactivity detection is enabled (default: true)
 */
export const useInactivity = ({ onLogout, enabled = true } = {}) => {
  const navigate = useNavigate();
  const lastActivityRef = useRef(Date.now());
  const checkIntervalRef = useRef(null);
  const warningTimeoutRef = useRef(null);

  // Track user activity
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Check if user should be logged out
  const checkInactivity = useCallback(async () => {
    if (!enabled) return;

    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;

    // Check with backend to see if session is still valid
    const token = localStorage.getItem("token") || localStorage.getItem("adminToken");
    
    if (!token) {
      return; // No token, user is already logged out
    }

    try {
      // Check session status with backend
      const role = localStorage.getItem("adminToken") ? "admin" : "counselor";
      const endpoint = role === "admin" 
        ? `${BASE_URL}/api/admin/dashboard`
        : `${BASE_URL}/api/profile`;

      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000, // 5 second timeout
      });

      // If backend returns session inactive error
      if (response.data.code === "SESSION_INACTIVE") {
        handleLogout("Session expired due to inactivity");
        return;
      }

      // Check client-side inactivity
      if (timeSinceLastActivity >= INACTIVITY_TIMEOUT_MS) {
        handleLogout("You have been inactive for 1 hour. Please log in again.");
        return;
      }

      // Show warning at 50 minutes (10 minutes before logout)
      const warningTime = INACTIVITY_TIMEOUT_MS - (10 * 60 * 1000); // 50 minutes
      if (timeSinceLastActivity >= warningTime && !warningTimeoutRef.current) {
        showWarning();
      }
    } catch (error) {
      // If backend says session is invalid, logout
      if (error.response?.status === 401 || error.response?.data?.code === "SESSION_INACTIVE") {
        handleLogout("Session expired. Please log in again.");
      }
      // Otherwise, silently fail (network issues shouldn't logout user)
    }
  }, [enabled]);

  // Show warning to user
  const showWarning = useCallback(() => {
    Swal.fire({
      title: "Inactivity Warning",
      text: "You have been inactive for 50 minutes. You will be automatically logged out in 10 minutes if there's no activity.",
      icon: "warning",
      confirmButtonText: "Stay Logged In",
      confirmButtonColor: "#4f46e5",
      showCancelButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
    }).then(() => {
      // User clicked OK, reset activity
      updateActivity();
      warningTimeoutRef.current = null;
    });
  }, [updateActivity]);

  // Handle logout
  const handleLogout = useCallback((message) => {
    const wasAdmin = Boolean(localStorage.getItem("adminToken"));
    // Clear warning timeout if exists
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }

    // Clear tokens
    localStorage.removeItem("token");
    localStorage.removeItem("adminToken");

    // Show logout message
    Swal.fire({
      title: "Session Expired",
      text: message || "You have been logged out due to inactivity.",
      icon: "info",
      confirmButtonText: "OK",
      confirmButtonColor: "#4f46e5",
      allowOutsideClick: false,
      allowEscapeKey: false,
    }).then(() => {
      // Call custom logout handler if provided
      if (onLogout) {
        onLogout();
      } else {
        // Default: redirect to login based on role before token cleanup
        if (wasAdmin) {
          navigate("/adminlogin", { replace: true });
        } else {
          navigate("/login", { replace: true });
        }
      }
    });
  }, [navigate, onLogout]);

  // Set up activity listeners
  useEffect(() => {
    if (!enabled) return;

    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];

    const handleActivity = () => {
      updateActivity();
      // Clear warning if user becomes active
      if (warningTimeoutRef.current) {
        Swal.close();
        warningTimeoutRef.current = null;
      }
    };

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, true);
    });

    // Set up periodic check
    checkIntervalRef.current = setInterval(checkInactivity, CHECK_INTERVAL_MS);

    // Initial check after 1 minute
    const initialCheckTimeout = setTimeout(checkInactivity, 60000);

    return () => {
      // Cleanup
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity, true);
      });
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      clearTimeout(initialCheckTimeout);
    };
  }, [enabled, updateActivity, checkInactivity]);

  return {
    updateActivity,
    checkInactivity,
  };
};

export default useInactivity;

