import { useEffect, useState } from "react";
import { CalendarDays, FileText, Mail, ShieldCheck, User as UserIcon } from "lucide-react";
import { apiFetch } from "../utils/api";
import { getUser, setUser } from "../utils/session";
import { formatBytes } from "../utils/storage";

function formatDateTime(value) {
  if (!value) return "Not available";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "Not available";
  return dt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function Profile() {
  const [profile, setProfile] = useState(() => getUser());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        const res = await apiFetch("/auth/me");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.detail || "Failed to load profile");
        }
        if (!active) return;
        const nextProfile = {
          user_id: data.user_id,
          username: data.username,
          email: data.email,
          created_at: data.created_at,
          last_login: data.last_login,
          total_documents: data.total_documents ?? 0,
          used_storage_bytes: data.used_storage_bytes ?? 0,
          storage_quota_bytes: data.storage_quota_bytes ?? 0,
          remaining_storage_bytes: data.remaining_storage_bytes ?? 0,
        };
        setProfile(nextProfile);
        setUser(nextProfile);
        setError("");
      } catch (err) {
        if (!active) return;
        setError(err.message || "Failed to load profile");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-blue-200 bg-gradient-to-r from-slate-900 via-blue-900 to-blue-700 px-7 py-8 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-blue-100">Account Profile</p>
        <h2 className="mt-3 text-3xl font-bold">My Profile</h2>
        <p className="mt-2 text-sm text-blue-100">Review your account details and current vault footprint.</p>
      </section>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Username</p>
          <p className="text-2xl font-bold text-slate-900">{profile.username || "-"}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total documents</p>
          <p className="text-2xl font-bold text-slate-900">{profile.total_documents ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Storage used</p>
          <p className="text-base font-semibold text-slate-900">
            {formatBytes(profile.used_storage_bytes ?? 0)} / {formatBytes(profile.storage_quota_bytes ?? 0)}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-gray-500">Loading profile...</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 inline-flex items-center gap-2 font-medium text-slate-900">
                <UserIcon size={16} />
                Identity
              </div>
              <div className="space-y-3 text-sm text-slate-700">
                <div className="flex items-center gap-3">
                  <UserIcon size={15} className="text-slate-500" />
                  <span>{profile.username || "Not available"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail size={15} className="text-slate-500" />
                  <span>{profile.email || "Not available"}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 inline-flex items-center gap-2 font-medium text-slate-900">
                <ShieldCheck size={16} />
                Account Activity
              </div>
              <div className="space-y-3 text-sm text-slate-700">
                <div className="flex items-center gap-3">
                  <CalendarDays size={15} className="text-slate-500" />
                  <span>Joined: {formatDateTime(profile.created_at)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <FileText size={15} className="text-slate-500" />
                  <span>Encrypted files stored: {profile.total_documents ?? 0}</span>
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck size={15} className="text-slate-500" />
                  <span>Remaining storage: {formatBytes(profile.remaining_storage_bytes ?? 0)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <CalendarDays size={15} className="text-slate-500" />
                  <span>Last login: {formatDateTime(profile.last_login)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default Profile;
