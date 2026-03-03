import { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";

function formatDateTime(value) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString();
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

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-bold">My Activity</h2>
        <p className="text-sm text-gray-500 mt-1">Share access logs for your files</p>
      </div>

      {loading && <p className="text-gray-500">Loading activity logs...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-3 text-xs font-semibold text-gray-500 border-b bg-gray-50">
            <div className="col-span-3">Name</div>
            <div className="col-span-3">Accessed By</div>
            <div className="col-span-2">No. of Access</div>
            <div className="col-span-2">Latest Access Time</div>
            <div className="col-span-2">Status</div>
          </div>

          {logs.length === 0 && (
            <div className="px-4 py-8 text-sm text-gray-500">No activity found yet.</div>
          )}

          {logs.map((row) => (
            <div key={row.share_id} className="border-b last:border-b-0">
              <div className="grid grid-cols-12 gap-3 px-4 py-3 text-sm items-center">
                <div className="col-span-3 truncate font-medium" title={row.name}>
                  {row.name}
                </div>
                <div className="col-span-3 truncate" title={row.accessed_by}>
                  {(() => {
                    const parsed = parseViewerLabel(row.accessed_by);
                    const hoverText = parsed.detail ? `${parsed.id} | ${parsed.detail}` : parsed.full;
                    return (
                  <button
                    className="text-left text-blue-700 hover:underline disabled:text-gray-400 disabled:no-underline"
                    disabled={!row.viewer_entries?.length}
                    onClick={() =>
                      setExpandedShareId(expandedShareId === row.share_id ? null : row.share_id)
                    }
                    title={hoverText}
                  >
                    {parsed.id}
                    {row.unique_viewer_count > 1 ? ` (${row.unique_viewer_count})` : ""}
                  </button>
                    );
                  })()}
                </div>
                <div className="col-span-2">{row.number_of_time_accessed}</div>
                <div className="col-span-2">
                  <button
                    className="text-left text-blue-700 hover:underline disabled:text-gray-400 disabled:no-underline"
                    disabled={!row.latest_time_accessed}
                    onClick={() =>
                      setExpandedShareId(expandedShareId === row.share_id ? null : row.share_id)
                    }
                  >
                    {formatDateTime(row.latest_time_accessed)}
                  </button>
                </div>
                <div className="col-span-2">
                  <span
                    className={`inline-flex text-xs px-2 py-1 rounded-full ${statusStyle(row.status)}`}
                  >
                    {statusLabel(row.status)}
                  </span>
                </div>
              </div>

              {expandedShareId === row.share_id && (
                <div className="px-4 pb-4">
                  <div className="rounded-md border bg-slate-50 p-3 space-y-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                        Unique viewers
                      </p>
                      {row.viewer_entries?.length ? (
                        <ul className="space-y-1 text-sm text-gray-700">
                          {row.viewer_entries.map((viewer, idx) => {
                            const parsed = parseViewerLabel(viewer.viewer_label);
                            const hoverText = parsed.detail ? `${parsed.id} | ${parsed.detail}` : parsed.full;
                            return (
                              <li key={`${row.share_id}-viewer-${idx}`} title={hoverText}>
                                {parsed.id} - {formatDateTime(viewer.latest_time_accessed)} ({viewer.access_count})
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500">No access yet.</p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                        All access times
                      </p>
                      {row.all_access_times?.length ? (
                        <ul className="space-y-1 text-sm text-gray-700">
                          {row.all_access_times.map((time, idx) => (
                            <li key={`${row.share_id}-${idx}`}>{formatDateTime(time)}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500">No access yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Activity;
