import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../config/apiBaseUrl";

// Badge-only component (for use inside buttons)
export function NotificationBadgeBadge() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const token = localStorage.getItem("token") || localStorage.getItem("authToken");
        if (!token) {
          setLoading(false);
          return;
        }

        const baseUrl = API_BASE_URL;
        const res = await axios.get(
          `${baseUrl}/api/counselor/notifications/unread-count`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        setUnreadCount(res.data.unreadCount || 0);
      } catch (err) {
        console.error("❌ Error fetching unread count:", err);
        setUnreadCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchUnreadCount();

    // Poll for updates every 10 seconds
    const interval = setInterval(fetchUnreadCount, 10000);

    return () => clearInterval(interval);
  }, []);

  if (loading || unreadCount === 0) {
    return null;
  }

  return (
    <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-md">
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  );
}

/** Unread count for counselor ↔ admin direct messages (sidebar Messages item). */
export function MessagesBadgeBadge() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const token = localStorage.getItem("token") || localStorage.getItem("authToken");
        if (!token) {
          setLoading(false);
          return;
        }
        const baseUrl = API_BASE_URL;
        const res = await axios.get(`${baseUrl}/api/counselor/messages/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUnreadCount(res.data?.unreadCount ?? 0);
      } catch {
        setUnreadCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 12000);
    return () => clearInterval(interval);
  }, []);

  if (loading || unreadCount === 0) {
    return null;
  }

  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shadow-md dark:bg-indigo-500">
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  );
}

/** Unread counselor → admin direct messages (admin sidebar). */
export function AdminMessagesBadgeBadge() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const token = localStorage.getItem("adminToken");
        if (!token) {
          setLoading(false);
          return;
        }
        const baseUrl = API_BASE_URL;
        const res = await axios.get(`${baseUrl}/api/admin/messages/unread-total`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUnreadCount(res.data?.unreadCount ?? 0);
      } catch {
        setUnreadCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 12000);
    return () => clearInterval(interval);
  }, []);

  if (loading || unreadCount === 0) {
    return null;
  }

  return (
    <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white shadow-md dark:bg-indigo-500">
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  );
}

// Full button component (standalone use)
export default function NotificationBadge() {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const token = localStorage.getItem("token") || localStorage.getItem("authToken");
        if (!token) {
          setLoading(false);
          return;
        }

        const baseUrl = API_BASE_URL;
        const res = await axios.get(
          `${baseUrl}/api/counselor/notifications/unread-count`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        setUnreadCount(res.data.unreadCount || 0);
      } catch (err) {
        console.error("❌ Error fetching unread count:", err);
        setUnreadCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchUnreadCount();

    // Poll for updates every 10 seconds
    const interval = setInterval(fetchUnreadCount, 10000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return null;
  }

  if (unreadCount === 0) {
    return (
      <button
        onClick={() => navigate("/notifications")}
        className="p-3 rounded-xl border border-indigo-50 bg-gradient-to-r from-white to-orange-50 hover:to-white text-gray-900 font-semibold text-left transition-all w-full"
        title="Notification Center"
      >
            Notification Center
      </button>
    );
  }

  return (
    <button
      onClick={() => navigate("/notifications")}
      className="relative p-3 rounded-xl border-2 border-indigo-500 bg-gradient-to-r from-indigo-50 to-orange-50 hover:from-indigo-100 hover:to-orange-100 text-gray-900 font-semibold text-left transition-all w-full"
      title={`${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`}
    >
      Notification Center
      <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg">
        {unreadCount > 99 ? "99+" : unreadCount}
      </span>
    </button>
  );
}

