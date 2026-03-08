import { Bell, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import UserDropdown from "./UserDropdown";
import { API_BASE, apiFetch } from "../utils/api";
import { getAccessToken } from "../utils/session";

function formatDateTime(value) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function TopBar({
  sidebarCollapsed = false,
  onToggleSidebar,
  onToggleMobileSidebar,
  searchQuery = "",
  onSearchChange = () => {},
}) {
  const location = useLocation();
  const [panelOpen, setPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [feedStatus, setFeedStatus] = useState("idle");
  const [markingRead, setMarkingRead] = useState(false);
  const [seenAt, setSeenAt] = useState(null);
  const bellRef = useRef(null);
  const panelRef = useRef(null);
  const latestIdRef = useRef(null);
  const seenAtRef = useRef(null);

  const title = location.pathname.includes("/vaults")
    ? "Vaults"
    : location.pathname.includes("/activity")
    ? "My Activity"
    : location.pathname.includes("/settings")
    ? "Settings"
    : "Dashboard";

  const streamUrl = useMemo(() => {
    const token = getAccessToken();
    if (!token) return null;
    return `${API_BASE}/notifications/stream?access_token=${encodeURIComponent(token)}`;
  }, []);

  useEffect(() => {
    seenAtRef.current = seenAt;
  }, [seenAt]);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      try {
        const res = await apiFetch("/notifications?limit=25");
        const data = await res.json();
        if (!res.ok) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        if (!active) return;
        setNotifications(items);
        setUnreadCount(Number(data?.unread_count || 0));
        setSeenAt(data?.seen_at || null);
        latestIdRef.current = items[0]?.id || null;
      } catch {
        // keep bell usable even if initial pull fails
      }
    };
    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!streamUrl) return undefined;

    let pollHandle = null;
    let eventSource = null;
    let closed = false;

    const mergeNotifications = (nextItem) => {
      setNotifications((prev) => {
        const withoutDup = prev.filter((item) => item.id !== nextItem.id);
        return [nextItem, ...withoutDup].slice(0, 30);
      });
      if (latestIdRef.current !== nextItem.id) {
        latestIdRef.current = nextItem.id;
        const seen = seenAtRef.current;
        if (!seen) {
          setUnreadCount((prev) => prev + 1);
          return;
        }
        const seenTs = Date.parse(seen);
        const eventTs = Date.parse(nextItem.created_at || "");
        if (Number.isNaN(seenTs) || Number.isNaN(eventTs) || eventTs > seenTs) {
          setUnreadCount((prev) => prev + 1);
        }
      }
    };

    const startPolling = () => {
      if (pollHandle) return;
      setFeedStatus("polling");
      pollHandle = window.setInterval(async () => {
        try {
          const res = await apiFetch("/notifications?limit=10");
          const data = await res.json();
          if (!res.ok) return;
          const items = Array.isArray(data?.items) ? data.items : [];
          if (!items.length) return;
          setUnreadCount(Number(data?.unread_count || 0));
          setSeenAt(data?.seen_at || null);
          for (const item of items.slice().reverse()) {
            if (item?.id && item.id !== latestIdRef.current) {
              mergeNotifications(item);
            }
          }
        } catch {
          // keep last successful state
        }
      }, 5000);
    };

    try {
      eventSource = new EventSource(streamUrl);
      setFeedStatus("live");

      eventSource.addEventListener("notification", (event) => {
        try {
          const payload = JSON.parse(event.data || "{}");
          if (!payload?.id) return;
          mergeNotifications(payload);
          setFeedStatus("live");
        } catch {
          // ignore malformed events
        }
      });

      eventSource.onerror = () => {
        if (closed) return;
        setFeedStatus("reconnecting");
        eventSource?.close();
        eventSource = null;
        startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      closed = true;
      eventSource?.close();
      if (pollHandle) window.clearInterval(pollHandle);
    };
  }, [streamUrl]);

  const markAllAsRead = async () => {
    try {
      setMarkingRead(true);
      const res = await apiFetch("/notifications/read-all", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setUnreadCount(0);
      setSeenAt(data?.seen_at || new Date().toISOString());
    } finally {
      setMarkingRead(false);
    }
  };

  useEffect(() => {
    if (!panelOpen) return undefined;
    const onDocClick = (event) => {
      const node = event.target;
      if (panelRef.current?.contains(node) || bellRef.current?.contains(node)) return;
      setPanelOpen(false);
    };
    window.addEventListener("mousedown", onDocClick);
    return () => window.removeEventListener("mousedown", onDocClick);
  }, [panelOpen]);

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/90 backdrop-blur border-b border-slate-200 flex items-center justify-between px-3 md:px-6">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="inline-flex rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 md:hidden"
          title="Open sidebar"
        >
          <Menu size={18} />
        </button>
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden md:inline-flex rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <h2 className="text-base font-semibold text-gray-800 md:text-xl">{title}</h2>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 md:gap-4">
        <input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="hidden rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 lg:block"
        />

        {/* Bell icon */}
        <button
          ref={bellRef}
          className="relative p-2 rounded-full hover:bg-gray-100"
          onClick={() => setPanelOpen((prev) => !prev)}
          title="Notifications"
        >
          <Bell size={20} className="text-gray-600" />
          {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
        </button>
        {panelOpen && (
          <div
            ref={panelRef}
            className="absolute right-14 top-14 z-30 w-[24rem] max-w-[90vw] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  {feedStatus === "live" ? "Live" : feedStatus === "polling" ? "Polling" : "Idle"}
                </span>
                <button
                  type="button"
                  disabled={markingRead || unreadCount === 0}
                  onClick={markAllAsRead}
                  className="text-xs text-blue-700 hover:underline disabled:text-gray-400 disabled:no-underline"
                >
                  {markingRead ? "Marking..." : "Mark all as read"}
                </button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-4 text-sm text-gray-500">No notifications yet.</p>
              ) : (
                notifications.map((item) => (
                  <div key={item.id} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
                    <p className="text-sm text-slate-800">{item.message}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {item.action === "download" ? "Download" : "Preview"} • {formatDateTime(item.created_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* User avatar */}
        <UserDropdown />
      </div>
    </header>
  );
}

export default TopBar;
