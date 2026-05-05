import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import Swal from "sweetalert2";
import CounselorSidebar from "../components/CounselorSidebar";
import CounselorHeaderProfile from "../components/CounselorHeaderProfile.jsx";
import { initializeTheme } from "../utils/themeUtils";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_URL = `${BASE_URL}/api/counselor/messages`;

const pageStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const pageItem = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function MessagesPage() {
  useDocumentTitle("Messages");
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [body, setBody] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    initializeTheme();
  }, []);

  const authHeaders = () => {
    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchUnread = useCallback(async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      if (!token) return;
      const res = await axios.get(`${API_URL}/unread-count`, { headers: authHeaders() });
      setUnreadCount(res.data?.unreadCount ?? 0);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token") || localStorage.getItem("authToken");
      if (!token) {
        navigate("/login");
        return;
      }
      const res = await axios.get(API_URL, {
        headers: authHeaders(),
        params: { page: 1, limit: 100 },
      });
      if (res.data?.success) {
        setMessages(res.data.messages || []);
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) {
        navigate("/login");
      } else {
        Swal.fire({
          icon: "error",
          title: "Could not load messages",
          text: err.response?.data?.message || "Try again later.",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("authToken");
    if (!token) {
      navigate("/login");
      return;
    }
    (async () => {
      await fetchMessages();
      try {
        await axios.post(`${API_URL}/mark-read`, {}, { headers: authHeaders() });
        await fetchUnread();
      } catch (e) {
        console.error(e);
      }
    })();
  }, [fetchMessages, fetchUnread, navigate]);

  useEffect(() => {
    const id = setInterval(() => {
      fetchUnread();
      fetchMessages();
    }, 25000);
    return () => clearInterval(id);
  }, [fetchUnread, fetchMessages]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await axios.post(API_URL, { body: trimmed }, { headers: authHeaders() });
      setBody("");
      await fetchMessages();
      await fetchUnread();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Send failed",
        text: err.response?.data?.message || "Could not send message.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page-bg counselor-typography flex min-h-[100dvh] w-full flex-col font-sans text-gray-900 dark:text-gray-100">
      <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col min-h-0 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <motion.main
          className="flex min-h-0 min-w-0 flex-1 flex-col gap-5"
          variants={pageStagger}
          initial="hidden"
          animate="show"
        >
          <motion.header
            variants={pageItem}
            className="flex shrink-0 flex-col gap-4 border-b border-gray-200/80 pb-5 dark:border-gray-700/80 sm:flex-row sm:items-start sm:justify-between sm:pb-6"
          >
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <CounselorSidebar variant="header" />
              <div className="hidden h-10 w-px shrink-0 bg-gray-200 dark:bg-gray-700 sm:block" aria-hidden />
              <div className="min-w-0 space-y-2 pt-0.5">
                <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                  Inbox
                </p>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <h1 className="m-0 text-2xl font-semibold tracking-tight sm:text-3xl">Messages</h1>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-semibold text-white dark:bg-indigo-500">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                <p className="m-0 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  One thread with the administration team. New admin replies also appear in your notifications.
                </p>
              </div>
            </div>
            <CounselorHeaderProfile className="sm:pt-1" />
          </motion.header>

          <motion.section
            variants={pageItem}
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm dark:border-gray-700/90 dark:bg-gray-800/95"
          >
            <div className="shrink-0 border-b border-gray-100 px-4 py-3 sm:px-6 dark:border-gray-700">
              <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Conversation
              </p>
              <p className="mt-0.5 m-0 text-sm font-medium text-gray-800 dark:text-gray-200">Administration</p>
            </div>

            <div
              ref={listRef}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-gray-50/50 px-4 py-4 dark:bg-gray-900/25 sm:px-8 sm:py-6"
            >
              {loading && messages.length === 0 ? (
                <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</p>
              ) : messages.length === 0 ? (
                <div className="mx-auto max-w-md rounded-xl border border-dashed border-gray-200 px-6 py-12 text-center dark:border-gray-600">
                  <p className="m-0 text-sm font-medium text-gray-700 dark:text-gray-300">No messages yet</p>
                  <p className="mt-2 m-0 text-sm text-gray-500 dark:text-gray-400">
                    Introduce yourself or ask a question below. The admin team will reply here.
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  const mine = m.senderRole === "counselor";
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[min(100%,42rem)] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                          mine
                            ? "bg-indigo-600 text-white dark:bg-indigo-500"
                            : "border border-gray-200 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                        }`}
                      >
                        {!mine && (
                          <p className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {m.senderName}
                          </p>
                        )}
                        <p className="m-0 whitespace-pre-wrap break-words">{m.body}</p>
                        <p
                          className={`mt-2 m-0 text-[10px] tabular-nums ${
                            mine ? "text-indigo-100" : "text-gray-400 dark:text-gray-500"
                          }`}
                        >
                          {m.createdAt
                            ? new Date(m.createdAt).toLocaleString(undefined, {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : ""}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form
              onSubmit={sendMessage}
              className="shrink-0 border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800 sm:px-6 sm:py-4"
            >
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Message to admin
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={2}
                maxLength={4000}
                placeholder="Type your message…"
                className="mb-2 min-h-[2.75rem] w-full resize-y rounded-xl border border-gray-200 bg-gray-50/80 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/25"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-gray-400 dark:text-gray-500">{body.length} / 4000</span>
                <button
                  type="submit"
                  disabled={sending || !body.trim()}
                  className="h-10 rounded-xl bg-gray-900 px-5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          </motion.section>
        </motion.main>
      </div>
    </div>
  );
}
