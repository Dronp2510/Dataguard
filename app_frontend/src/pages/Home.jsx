import { Fragment, useEffect, useMemo, useState } from "react";
import { Activity, FileText, Folder, Link2, MoreVertical, ShieldCheck, Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOutletContext } from "react-router-dom";
import FilePreviewModal from "../components/FilePreviewModal";
import ShareModal from "../components/ShareModal";
import { apiFetch } from "../utils/api";

function formatDateTime(value) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function statusStyle(status) {
  if (status === "active") return "bg-emerald-100 text-emerald-700";
  if (status === "expired") return "bg-amber-100 text-amber-700";
  if (status === "revoked") return "bg-slate-200 text-slate-700";
  return "bg-rose-100 text-rose-700";
}

function statusLabel(status) {
  if (status === "active") return "Active";
  if (status === "expired") return "Expired";
  if (status === "revoked") return "Revoked";
  if (status === "view_limit_reached") return "View limit reached";
  return status;
}

function parseViewerLabel(label) {
  const raw = String(label || "").trim();
  if (!raw || raw === "No access yet") {
    return { id: "No access yet", detail: "", full: raw || "No access yet" };
  }

  if (raw.startsWith("User:")) {
    const body = raw.slice(5).trim();
    const parts = body.split("|").map((part) => part.trim()).filter(Boolean);
    return {
      id: parts[0] || "User",
      detail: parts.slice(1).join(" | "),
      full: raw,
    };
  }

  if (raw.startsWith("Guest:")) {
    const body = raw.slice(6).trim();
    const parts = body.split("|").map((part) => part.trim()).filter(Boolean);
    return {
      id: parts[0] || "Guest",
      detail: parts.slice(1).join(" | "),
      full: raw,
    };
  }

  return { id: raw, detail: "", full: raw };
}

function ShareActionMenu({
  row,
  openMenuId,
  setOpenMenuId,
  revokingShareId,
  onRevoke,
  align = "right",
  direction = "down",
}) {
  if (row.status !== "active") return null;

  const menuPositionClass = align === "left" ? "left-0" : "right-0";
  const menuDirectionClass = direction === "up" ? "bottom-full mb-2" : "top-full mt-2";

  return (
    <div className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        onClick={(e) => {
          e.stopPropagation();
          setOpenMenuId(openMenuId === row.share_id ? null : row.share_id);
        }}
        aria-label="Open share actions"
        title="Share actions"
      >
        <MoreVertical size={16} />
      </button>
      {openMenuId === row.share_id && (
        <div
          className={`absolute z-20 w-36 rounded-md border border-slate-200 bg-white py-1 shadow-lg ${menuPositionClass} ${menuDirectionClass}`}
        >
          <button
            type="button"
            onClick={() => onRevoke(row.share_id)}
            disabled={revokingShareId === row.share_id}
            className="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:text-slate-400 disabled:hover:bg-transparent"
          >
            {revokingShareId === row.share_id ? "Revoking..." : "Revoke access"}
          </button>
        </div>
      )}
    </div>
  );
}

function Home() {
  const { searchQuery = "" } = useOutletContext() || {};
  const [recent, setRecent] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedShareId, setExpandedShareId] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [revokingShareId, setRevokingShareId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const navigate = useNavigate();

  const user = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        const [recentRes, logsRes] = await Promise.all([
          apiFetch("/vault/recent?limit=6"),
          apiFetch("/activity/logs"),
        ]);

        const [recentData, logsData] = await Promise.all([
          recentRes.json(),
          logsRes.json(),
        ]);

        if (!recentRes.ok) {
          throw new Error(recentData.detail || "Failed to load recent uploads");
        }

        if (!logsRes.ok) {
          throw new Error(logsData.detail || "Failed to load activity logs");
        }

        if (active) {
          setRecent(Array.isArray(recentData) ? recentData : []);
          setLogs(Array.isArray(logsData) ? logsData : []);
        }
      } catch (err) {
        if (active) setError(err.message || "Failed to load dashboard data");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const filteredRecent = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return recent;
    return recent.filter((item) => String(item.name || "").toLowerCase().includes(q));
  }, [recent, searchQuery]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((row) => {
      const name = String(row.name || "").toLowerCase();
      const accessedBy = String(row.accessed_by || "").toLowerCase();
      const viewers = Array.isArray(row.viewer_entries)
        ? row.viewer_entries.some((viewer) => String(viewer.viewer_label || "").toLowerCase().includes(q))
        : false;
      return name.includes(q) || accessedBy.includes(q) || viewers;
    });
  }, [logs, searchQuery]);

  const totalAccess = filteredLogs.reduce((sum, row) => sum + (row.number_of_time_accessed || 0), 0);
  const activeLinks = filteredLogs.filter((row) => row.status === "active").length;
  const recentFiles = filteredRecent.filter((item) => item.type === "file").length;

  const revokeShare = async (shareId) => {
    try {
      setRevokingShareId(shareId);
      const res = await apiFetch(`/share/${shareId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Failed to revoke share");
      }
      setOpenMenuId(null);
      setLogs((prev) =>
        prev.map((row) =>
          row.share_id === shareId
            ? {
                ...row,
                status: "revoked",
              }
            : row
        )
      );
    } catch (err) {
      setError(err.message || "Failed to revoke share");
    } finally {
      setRevokingShareId(null);
    }
  };

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-r from-slate-900 via-blue-900 to-blue-700 px-8 py-10 text-white shadow-lg">
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10 blur-xl" />
        <div className="absolute -bottom-10 left-1/3 h-40 w-40 rounded-full bg-cyan-300/20 blur-2xl" />

        <p className="text-xs uppercase tracking-[0.2em] text-blue-100">Secure Workspace</p>
        <h1 className="mt-3 text-3xl font-bold md:text-4xl">Welcome{user?.username ? `, ${user.username}` : ""}</h1>
        <p className="mt-3 max-w-2xl text-sm text-blue-100 md:text-base">
          Your latest uploads and sharing activity are monitored here so you can track what changed at a glance.
        </p>
      </section>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 inline-flex rounded-lg bg-blue-100 p-2 text-blue-700">
            <Folder size={18} />
          </div>
          <p className="text-sm text-gray-500">Recent uploads shown</p>
          <p className="text-2xl font-bold text-slate-900">{filteredRecent.length}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 inline-flex rounded-lg bg-emerald-100 p-2 text-emerald-700">
            <Link2 size={18} />
          </div>
          <p className="text-sm text-gray-500">Active shared links</p>
          <p className="text-2xl font-bold text-slate-900">{activeLinks}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 inline-flex rounded-lg bg-purple-100 p-2 text-purple-700">
            <Activity size={18} />
          </div>
          <p className="text-sm text-gray-500">Total share accesses</p>
          <p className="text-2xl font-bold text-slate-900">{totalAccess}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Previous uploaded files</h2>
          <p className="text-sm text-gray-500">Files in view: {recentFiles}</p>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading recent uploads...</p>
        ) : filteredRecent.length === 0 ? (
          <p className="text-sm text-gray-500">No uploads found yet.</p>
        ) : (
          <>
            <div className="-mx-2 flex snap-x snap-mandatory gap-4 overflow-x-auto px-2 pb-2 md:hidden">
              {filteredRecent.map((item) => (
                <article
                  key={`${item.type}-${item.id}`}
                  className="min-w-[84%] snap-start rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {item.type === "folder" ? (
                        <Folder className="shrink-0 text-amber-500" size={18} />
                      ) : (
                        <FileText className="shrink-0 text-blue-500" size={18} />
                      )}
                      <span className="text-xs font-medium uppercase text-gray-500">{item.type}</span>
                    </div>
                    {item.type === "file" ? (
                      <button
                        type="button"
                        title="Share file"
                        onClick={() => setSelectedFile(item)}
                        className="rounded p-1 text-gray-400 transition hover:bg-slate-100 hover:text-blue-600"
                      >
                        <Share2 size={16} />
                      </button>
                    ) : (
                      <Share2 size={16} className="text-gray-300" />
                    )}
                  </div>

                  <h3 className="min-h-[3rem] break-words font-semibold text-slate-900" title={item.name}>
                    {item.name}
                  </h3>
                  <p className="mt-2 text-xs text-gray-500">Uploaded: {formatDateTime(item.created_at)}</p>
                  <div className="mt-4 flex gap-2">
                    {item.type === "file" ? (
                      <button
                        type="button"
                        onClick={() => setPreviewFile(item)}
                        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white transition hover:bg-slate-700"
                      >
                        Open
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate("/app/vaults")}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100"
                      >
                        Open in Vaults
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
              {filteredRecent.map((item) => (
                <article
                  key={`${item.type}-${item.id}`}
                  className="group rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition hover:-translate-y-1 hover:border-blue-300 hover:bg-white hover:shadow-md"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {item.type === "folder" ? (
                        <Folder className="text-amber-500" size={18} />
                      ) : (
                        <FileText className="text-blue-500" size={18} />
                      )}
                      <span className="text-xs font-medium uppercase text-gray-500">{item.type}</span>
                    </div>
                    {item.type === "file" ? (
                      <button
                        type="button"
                        title="Share file"
                        onClick={() => setSelectedFile(item)}
                        className="rounded p-1 text-gray-400 transition hover:bg-slate-100 hover:text-blue-600"
                      >
                        <Share2 size={16} />
                      </button>
                    ) : (
                      <Share2 size={16} className="text-gray-300" />
                    )}
                  </div>

                  <h3 className="truncate font-semibold text-slate-900" title={item.name}>
                    {item.name}
                  </h3>
                  <p className="mt-2 text-xs text-gray-500">Uploaded: {formatDateTime(item.created_at)}</p>
                  <div className="mt-4 flex gap-2">
                    {item.type === "file" ? (
                      <button
                        type="button"
                        onClick={() => setPreviewFile(item)}
                        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white transition hover:bg-slate-700"
                      >
                        Open
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate("/app/vaults")}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100"
                      >
                        Open in Vaults
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Activity Log</h2>
            <p className="text-sm text-gray-500">Recent link access and status details</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white">
            <ShieldCheck size={14} />
            Monitored
          </div>
        </div>

        {loading ? (
          <p className="px-6 py-6 text-sm text-gray-500">Loading activity logs...</p>
        ) : filteredLogs.length === 0 ? (
          <p className="px-6 py-6 text-sm text-gray-500">No activity found yet.</p>
        ) : (
          <>
            <div className="divide-y divide-slate-100 md:hidden">
              {filteredLogs.map((row) => {
                const parsed = parseViewerLabel(row.accessed_by);
                const hoverText = parsed.detail ? `${parsed.id} | ${parsed.detail}` : parsed.full;
                const isExpanded = expandedShareId === row.share_id;

                return (
                  <article key={row.share_id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900" title={row.name}>
                          {row.name}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs ${statusStyle(row.status)}`}>
                            {statusLabel(row.status)}
                          </span>
                          <button
                            type="button"
                            className="text-left text-xs text-blue-700 hover:underline disabled:text-gray-400 disabled:no-underline"
                            disabled={!row.viewer_entries?.length}
                            onClick={() => setExpandedShareId(isExpanded ? null : row.share_id)}
                            title={hoverText}
                          >
                            {parsed.id}
                          </button>
                        </div>
                      </div>
                      <ShareActionMenu
                        row={row}
                        openMenuId={openMenuId}
                        setOpenMenuId={setOpenMenuId}
                        revokingShareId={revokingShareId}
                        onRevoke={revokeShare}
                        align="right"
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Unique viewers</p>
                        <p className="mt-1 font-medium text-slate-900">{row.unique_viewer_count || 0}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-gray-500">No. of access</p>
                        <p className="mt-1 font-medium text-slate-900">{row.number_of_time_accessed || 0}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Downloads</p>
                        <p className="mt-1 font-medium text-slate-900">{row.download_count || 0}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Downloaded?</p>
                        <span
                          className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs ${
                            row.is_downloaded ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {row.is_downloaded ? "Yes" : "No"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Latest access time (IST)</p>
                      <button
                        type="button"
                        className="mt-1 text-left text-blue-700 hover:underline disabled:text-gray-400 disabled:no-underline"
                        disabled={!row.latest_time_accessed}
                        onClick={() => setExpandedShareId(isExpanded ? null : row.share_id)}
                      >
                        {formatDateTime(row.latest_time_accessed)}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 grid gap-4">
                        <div className="rounded-md border border-slate-200 bg-white p-3">
                          <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Unique viewers</p>
                          {row.viewer_entries?.length ? (
                            <ul className="space-y-1 text-sm text-gray-700">
                              {row.viewer_entries.map((viewer, idx) => {
                                const viewerParsed = parseViewerLabel(viewer.viewer_label);
                                const viewerHover = viewerParsed.detail
                                  ? `${viewerParsed.id} | ${viewerParsed.detail}`
                                  : viewerParsed.full;
                                return (
                                  <li key={`${row.share_id}-home-viewer-mobile-${idx}`} title={viewerHover}>
                                    {viewerParsed.id} - {formatDateTime(viewer.latest_time_accessed)} ({viewer.access_count})
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-500">No access yet.</p>
                          )}
                        </div>
                        <div className="rounded-md border border-slate-200 bg-white p-3">
                          <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">All access events</p>
                          {row.all_access_entries?.length ? (
                            <ul className="space-y-1 text-sm text-gray-700">
                              {row.all_access_entries.map((entry, idx) => {
                                const entryViewer = parseViewerLabel(entry.viewer_label);
                                const actionLabel = entry.action === "download" ? "download" : "preview";
                                return (
                                  <li key={`${row.share_id}-home-entry-mobile-${idx}`}>
                                    {entryViewer.id} - {formatDateTime(entry.time_accessed)} ({actionLabel})
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-500">No access yet.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <div className="hidden md:block">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[31%]" />
                <col className="w-[13%]" />
                <col className="w-[9%]" />
                <col className="w-[10%]" />
                <col className="w-[11%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
                <col className="w-[6%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Accessed By</th>
                  <th className="px-6 py-3">Unique Viewers</th>
                  <th className="px-6 py-3">No. of Access</th>
                  <th className="px-6 py-3">Downloads</th>
                  <th className="px-6 py-3">Downloaded?</th>
                  <th className="px-6 py-3">Latest Access Time (IST)</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((row) => {
                  const parsed = parseViewerLabel(row.accessed_by);
                  const hoverText = parsed.detail ? `${parsed.id} | ${parsed.detail}` : parsed.full;
                  const isExpanded = expandedShareId === row.share_id;

                  return (
                    <Fragment key={row.share_id}>
                      <tr className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-900" title={row.name}>
                          <span className="block truncate">{row.name}</span>
                        </td>
                        <td className="px-6 py-3">
                          <button
                            className="block w-full truncate text-left text-blue-700 hover:underline disabled:text-gray-400 disabled:no-underline"
                            disabled={!row.viewer_entries?.length}
                            onClick={() =>
                              setExpandedShareId(isExpanded ? null : row.share_id)
                            }
                            title={hoverText}
                          >
                            {parsed.id}
                          </button>
                        </td>
                        <td className="px-6 py-3">{row.unique_viewer_count || 0}</td>
                        <td className="px-6 py-3">{row.number_of_time_accessed}</td>
                        <td className="px-6 py-3">{row.download_count || 0}</td>
                        <td className="px-6 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs ${
                              row.is_downloaded ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {row.is_downloaded ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <button
                            className="block w-full truncate text-left text-blue-700 hover:underline disabled:text-gray-400 disabled:no-underline"
                            disabled={!row.latest_time_accessed}
                            onClick={() =>
                              setExpandedShareId(isExpanded ? null : row.share_id)
                            }
                            title={row.latest_time_accessed ? formatDateTime(row.latest_time_accessed) : ""}
                          >
                            {formatDateTime(row.latest_time_accessed)}
                          </button>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs ${statusStyle(row.status)}`}>
                            {statusLabel(row.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 pr-6 text-right">
                          <ShareActionMenu
                            row={row}
                            openMenuId={openMenuId}
                            setOpenMenuId={setOpenMenuId}
                            revokingShareId={revokingShareId}
                            onRevoke={revokeShare}
                            align="right"
                            direction="up"
                          />
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-slate-100 bg-slate-50/70">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="rounded-md border border-slate-200 bg-white p-3">
                                <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Unique viewers</p>
                                {row.viewer_entries?.length ? (
                                  <ul className="space-y-1 text-sm text-gray-700">
                                    {row.viewer_entries.map((viewer, idx) => {
                                      const viewerParsed = parseViewerLabel(viewer.viewer_label);
                                      const viewerHover = viewerParsed.detail
                                        ? `${viewerParsed.id} | ${viewerParsed.detail}`
                                        : viewerParsed.full;
                                      return (
                                        <li key={`${row.share_id}-viewer-${idx}`} title={viewerHover}>
                                          {viewerParsed.id} - {formatDateTime(viewer.latest_time_accessed)} ({viewer.access_count})
                                        </li>
                                      );
                                    })}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-gray-500">No access yet.</p>
                                )}
                              </div>
                              <div className="rounded-md border border-slate-200 bg-white p-3">
                                <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">All access events</p>
                                {row.all_access_entries?.length ? (
                                  <ul className="space-y-1 text-sm text-gray-700">
                                    {row.all_access_entries.map((entry, idx) => {
                                      const entryViewer = parseViewerLabel(entry.viewer_label);
                                      const actionLabel = entry.action === "download" ? "download" : "preview";
                                      return (
                                        <li key={`${row.share_id}-entry-${idx}`}>
                                          {entryViewer.id} - {formatDateTime(entry.time_accessed)} ({actionLabel})
                                        </li>
                                      );
                                    })}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-gray-500">No access yet.</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
          </>
        )}
      </section>
      {previewFile && <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
      <ShareModal file={selectedFile} onClose={() => setSelectedFile(null)} />
    </div>
  );
}

export default Home;
