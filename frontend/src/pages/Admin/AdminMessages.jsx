import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import AdminSidebar from "../../components/AdminSidebar";
import { initializeTheme } from "../../utils/themeUtils";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { API_BASE_URL } from "../../config/apiBaseUrl";

const BASE_URL = API_BASE_URL;

export default function AdminMessages() {
  useDocumentTitle("Admin Messages");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [counselorMeta, setCounselorMeta] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const adminHeaders = () => {
    const token = localStorage.getItem("adminToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchThreads = useCallback(async () => {
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) {
        navigate("/adminlogin", { replace: true });
        return;
      }
      const res = await axios.get(`${BASE_URL}/api/admin/messages/threads`, {
        headers: adminHeaders(),
      });
      if (res.data?.success) {
        setThreads(res.data.threads || []);
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401) {
        navigate("/adminlogin", { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const fetchMessagesFor = useCallback(
    async (counselorId) => {
      if (!counselorId) return;
      setMsgLoading(true);
      try {
        const res = await axios.get(`${BASE_URL}/api/admin/messages/counselor/${counselorId}`, {
          headers: adminHeaders(),
          params: { page: 1, limit: 100 },
        });
        if (res.data?.success) {
          setCounselorMeta(res.data.counselor);
          setMessages(res.data.messages || []);
        }
        await axios.post(
          `${BASE_URL}/api/admin/messages/counselor/${counselorId}/mark-read`,
          {},
          { headers: adminHeaders() }
        );
        await fetchThreads();
      } catch (err) {
        console.error(err);
        Swal.fire({
          icon: "error",
          title: "Could not load thread",
          text: err.response?.data?.message || "Try again.",
        });
      } finally {
        setMsgLoading(false);
      }
    },
    [fetchThreads]
  );

  useEffect(() => {
    initializeTheme();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      navigate("/adminlogin", { replace: true });
      return;
    }
    fetchThreads();
    const id = setInterval(fetchThreads, 15000);
    return () => clearInterval(id);
  }, [fetchThreads, navigate]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const selectThread = async (counselorId) => {
    setSelectedId(counselorId);
    await fetchMessagesFor(counselorId);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!selectedId) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await axios.post(
        `${BASE_URL}/api/admin/messages/counselor/${selectedId}`,
        { body: trimmed },
        { headers: adminHeaders() }
      );
      setBody("");
      await fetchMessagesFor(selectedId);
      await fetchThreads();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Send failed",
        text: err.response?.data?.message || "Could not send.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page-bg admin-typography min-h-screen w-full font-sans text-gray-900 dark:text-gray-100">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="flex flex-col gap-8">
          <header className="flex flex-col gap-6 border-b border-gray-200/80 pb-8 dark:border-gray-700/80 sm:flex-row sm:items-start sm:justify-between sm:pb-10">
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <AdminSidebar variant="header" />
              <div className="hidden h-10 w-px shrink-0 bg-gray-200 dark:bg-gray-700 sm:block" aria-hidden />
              <div className="min-w-0 space-y-2">
                <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                  Administration
                </p>
                <h1 className="m-0 text-2xl font-semibold tracking-tight sm:text-3xl">Messages</h1>
                <p className="m-0 max-w-xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  Conversations with counselors. Choose a thread, then read and reply in one place.
                </p>
              </div>
            </div>
          </header>

          <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800/95 lg:min-h-[calc(100vh-14rem)] lg:flex-row">
            <aside className="flex w-full shrink-0 flex-col border-b border-gray-200 dark:border-gray-700 lg:w-[min(100%,320px)] lg:border-b-0 lg:border-r">
              <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
                <p className="m-0 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Counselors
                </p>
                <p className="mt-0.5 m-0 text-[11px] text-gray-400 dark:text-gray-500">
                  {threads.length} thread{threads.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="max-h-[42vh] min-h-[200px] flex-1 overflow-y-auto p-2 lg:max-h-none">
                {loading ? (
                  <p className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</p>
                ) : threads.length === 0 ? (
                  <div className="mx-2 rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
                    No conversations yet.
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {threads.map((t, idx) => {
                      const idStr = String(t.counselorId ?? "");
                      if (!idStr) return null;
                      const active = selectedId === idStr;
                      return (
                        <li key={idStr || `t-${idx}`}>
                          <button
                            type="button"
                            onClick={() => selectThread(idStr)}
                            className={`flex w-full flex-col gap-1 rounded-xl px-3 py-3 text-left text-sm transition-colors ${
                              active
                                ? "bg-indigo-50 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:ring-indigo-800/80"
                                : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                            }`}
                          >
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {t.counselorName || "Unknown"}
                            </span>
                            <span className="line-clamp-2 text-xs leading-snug text-gray-500 dark:text-gray-400">
                              {t.lastSenderRole === "counselor" ? "Counselor: " : "Admin: "}
                              {t.lastBody}
                            </span>
                            <span className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500">
                              {t.lastMessageAt
                                ? new Date(t.lastMessageAt).toLocaleString(undefined, {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })
                                : null}
                              {t.unreadFromCounselor > 0 && (
                                <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white dark:bg-indigo-500">
                                  {t.unreadFromCounselor} new
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </aside>

            <section className="flex min-h-[380px] min-w-0 flex-1 flex-col bg-gray-50/40 dark:bg-gray-900/20">
              {!selectedId ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                  <p className="m-0 text-sm font-medium text-gray-700 dark:text-gray-300">No thread selected</p>
                  <p className="m-0 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                    Pick a counselor from the list to view the conversation and reply.
                  </p>
                </div>
              ) : (
                <>
                  <div className="shrink-0 border-b border-gray-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-800">
                    <h2 className="m-0 text-base font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                      {counselorMeta?.name || "Counselor"}
                    </h2>
                    {counselorMeta?.email && (
                      <p className="mt-1 m-0 truncate text-xs text-gray-500 dark:text-gray-400">
                        {counselorMeta.email}
                      </p>
                    )}
                  </div>
                  <div
                    ref={listRef}
                    className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6"
                  >
                    {msgLoading && messages.length === 0 ? (
                      <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        Loading messages…
                      </p>
                    ) : (
                      messages.map((m) => {
                        const admin = m.senderRole === "admin";
                        return (
                          <div key={m.id} className={`flex ${admin ? "justify-end" : "justify-start"}`}>
                            <div
                              className={`max-w-[min(100%,28rem)] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                                admin
                                  ? "bg-indigo-600 text-white dark:bg-indigo-500"
                                  : "border border-gray-200 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                              }`}
                            >
                              {!admin && (
                                <p className="m-0 mb-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                                  {m.senderName}
                                </p>
                              )}
                              <p className="m-0 whitespace-pre-wrap break-words">{m.body}</p>
                              <p
                                className={`mt-2 m-0 text-[10px] tabular-nums ${
                                  admin ? "text-indigo-100" : "text-gray-400 dark:text-gray-500"
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
                    className="shrink-0 border-t border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-800 sm:px-6"
                  >
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Reply
                    </label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={3}
                      maxLength={4000}
                      placeholder="Write a message to this counselor…"
                      className="mb-3 w-full resize-y rounded-xl border border-gray-200 bg-gray-50/80 px-3.5 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/25"
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
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
