import { Fragment, useEffect, useMemo, useState } from "react";
import { Activity as ActivityIcon, Link2, ShieldCheck } from "lucide-react";
import { apiFetch } from "../utils/api";
import { useOutletContext } from "react-router-dom";

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

function Activity() {
  const { searchQuery = "" } = useOutletContext() || {};
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedShareId, setExpandedShareId] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const res = await apiFetch("/activity/logs");
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to load activity logs");
        if (active) setLogs(Array.isArray(data) ? data : []);
      } catch (err) {
        if (active) setError(err.message || "Failed to load activity logs");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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

  const totals = useMemo(() => {
    const totalAccess = filteredLogs.reduce((sum, row) => sum + (row.number_of_time_accessed || 0), 0);
    const activeLinks = filteredLogs.filter((row) => row.status === "active").length;
    return { totalAccess, activeLinks };
  }, [filteredLogs]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-blue-200 bg-gradient-to-r from-slate-900 via-blue-900 to-blue-700 px-7 py-8 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-blue-100">Share Analytics</p>
        <h2 className="mt-3 text-3xl font-bold">My Activity</h2>
        <p className="mt-2 text-sm text-blue-100">Track who accessed your shared files and when.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Tracked links</p>
          <p className="text-2xl font-bold text-slate-900">{filteredLogs.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Active links</p>
          <p className="text-2xl font-bold text-slate-900">{totals.activeLinks}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total accesses</p>
          <p className="text-2xl font-bold text-slate-900">{totals.totalAccess}</p>
        </div>
      </section>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {!error && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
            <div className="inline-flex items-center gap-2 text-slate-900">
              <ActivityIcon size={16} />
              <h3 className="font-semibold">Activity Log</h3>
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white">
              <ShieldCheck size={14} />
              Protected
            </div>
          </div>

          {loading ? (
            <p className="px-6 py-6 text-sm text-gray-500">Loading activity logs...</p>
          ) : filteredLogs.length === 0 ? (
            <p className="px-6 py-6 text-sm text-gray-500">No activity found yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Accessed By</th>
                    <th className="px-6 py-3">Unique Viewers</th>
                    <th className="px-6 py-3">No. of Access</th>
                    <th className="px-6 py-3">Latest Access Time (IST)</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((row) => {
                    const parsed = parseViewerLabel(row.accessed_by);
                    const hoverText = parsed.detail ? `${parsed.id} | ${parsed.detail}` : parsed.full;
                    const isExpanded = expandedShareId === row.share_id;

                    return (
                      <Fragment key={row.share_id}>
                        <tr className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-6 py-3 font-medium text-slate-900" title={row.name}>
                            <span className="block max-w-xs truncate">{row.name}</span>
                          </td>
                          <td className="px-6 py-3">
                            <button
                              className="text-left text-blue-700 hover:underline disabled:text-gray-400 disabled:no-underline"
                              disabled={!row.viewer_entries?.length}
                              onClick={() => setExpandedShareId(isExpanded ? null : row.share_id)}
                              title={hoverText}
                            >
                              {parsed.id}
                            </button>
                          </td>
                          <td className="px-6 py-3">{row.unique_viewer_count || 0}</td>
                          <td className="px-6 py-3">{row.number_of_time_accessed}</td>
                          <td className="px-6 py-3">
                            <button
                              className="text-left text-blue-700 hover:underline disabled:text-gray-400 disabled:no-underline"
                              disabled={!row.latest_time_accessed}
                              onClick={() => setExpandedShareId(isExpanded ? null : row.share_id)}
                            >
                              {formatDateTime(row.latest_time_accessed)}
                            </button>
                          </td>
                          <td className="px-6 py-3">
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs ${statusStyle(row.status)}`}>
                              {statusLabel(row.status)}
                            </span>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="border-b border-slate-100 bg-slate-50/70">
                            <td colSpan={6} className="px-6 py-4">
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
          )}
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-gradient-to-r from-blue-50 to-slate-50 p-4 text-sm text-slate-700">
        <div className="inline-flex items-center gap-2 font-medium text-slate-900">
          <Link2 size={16} />
          Link hygiene
        </div>
        <p className="mt-1">Revoke unused links from shared files to reduce long-term exposure.</p>
      </section>
    </div>
  );
}

export default Activity;
