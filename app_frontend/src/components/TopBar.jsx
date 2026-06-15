import { Bell, Menu, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import UserDropdown from "./UserDropdown";
import { apiFetch } from "../utils/api";

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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const bellRef = useRef(null);
  const panelRef = useRef(null);
  const latestIdRef = useRef(null);
  const seenAtRef = useRef(null);
  const mobileSearchInputRef = useRef(null);

  const title = location.pathname.includes("/vaults")
    ? "Vaults"
    : location.pathname.includes("/activity")
    ? "My Activity"
    : location.pathname.includes("/profile")
    ? "My Profile"
    : location.pathname.includes("/settings")
    ? "Settings"
    : "Dashboard";

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
    let pollHandle = null;

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

    const pollNotifications = async () => {
      try {
        const res = await apiFetch("/notifications?limit=10");
        const data = await res.json();
        if (!res.ok) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setFeedStatus("polling");
        setUnreadCount(Number(data?.unread_count || 0));
        setSeenAt(data?.seen_at || null);
        for (const item of items.slice().reverse()) {
          if (item?.id && item.id !== latestIdRef.current) {
            mergeNotifications(item);
          }
        }
      } catch {
        setFeedStatus("idle");
      }
    };

    setFeedStatus("polling");
    pollHandle = window.setInterval(pollNotifications, 5000);

    return () => {
      if (pollHandle) window.clearInterval(pollHandle);
    };
  }, []);

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

  useEffect(() => {
    setMobileSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileSearchOpen) return;
    mobileSearchInputRef.current?.focus();
  }, [mobileSearchOpen]);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-3 py-3 backdrop-blur md:rounded-xl md:h-16 md:px-6 md:py-0">
      <div className="flex items-center justify-between gap-3 md:h-full">
        <div className="flex min-w-0 items-center gap-3">
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
            className="hidden rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 md:inline-flex"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <h2 className="truncate text-base font-semibold text-gray-800 md:text-xl">{title}</h2>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="hidden rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 lg:block"
          />

          <button
            type="button"
            onClick={() => setMobileSearchOpen((prev) => !prev)}
            className="inline-flex rounded-full p-2 text-slate-700 hover:bg-gray-100 lg:hidden"
            title={mobileSearchOpen ? "Close search" : "Open search"}
            aria-label={mobileSearchOpen ? "Close search" : "Open search"}
          >
            {mobileSearchOpen ? <X size={18} /> : <Search size={18} />}
          </button>

          <button
            ref={bellRef}
            className="relative rounded-full p-2 hover:bg-gray-100"
            onClick={() => setPanelOpen((prev) => !prev)}
            title="Notifications"
          >
            <Bell size={20} className="text-gray-600" />
            {unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />}
          </button>
          {panelOpen && (
            <div
              ref={panelRef}
              className="fixed left-3 right-3 top-20 z-30 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl md:absolute md:left-auto md:right-14 md:top-14 md:w-[24rem] md:max-w-[90vw]"
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">Notifications</p>
                <div className="flex items-center gap-2 md:gap-3">
                  <span className="text-xs text-gray-500">
                    {feedStatus === "live" ? "Live" : feedStatus === "polling" ? "Polling" : "Idle"}
                  </span>
                  <button
                    type="button"
                    disabled={markingRead || unreadCount === 0}
                    onClick={markAllAsRead}
                    className="text-right text-xs text-blue-700 hover:underline disabled:text-gray-400 disabled:no-underline"
                  >
                    {markingRead ? "Marking..." : "Mark all as read"}
                  </button>
                </div>
              </div>
              <div className="max-h-[70vh] overflow-y-auto md:max-h-80">
                {notifications.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-gray-500">No notifications yet.</p>
                ) : (
                  notifications.map((item) => (
                    <div key={item.id} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
                      <p className="text-sm text-slate-800">{item.message}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {item.action === "download" ? "Download" : "Preview"} - {formatDateTime(item.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <UserDropdown />
        </div>
      </div>

      {mobileSearchOpen && (
        <div className="mt-3 lg:hidden">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              ref={mobileSearchInputRef}
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-10 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label="Clear search"
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export default TopBar;
