import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Lock, LogOut, Mail, ShieldCheck, User } from "lucide-react";
import { clearMasterKey } from "../utils/keyStore";
import { clearSession } from "../utils/session";
import { apiFetch } from "../utils/api";

function formatDateTime(value) {
  if (!value) return "Not available";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "Not available";
  return dt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function Settings() {
  const navigate = useNavigate();
  const user = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem("user") || localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const sessionExpiry = sessionStorage.getItem("dg_session_expires_at");

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-blue-200 bg-gradient-to-r from-slate-900 via-blue-900 to-blue-700 px-7 py-8 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-blue-100">Preferences</p>
        <h2 className="mt-3 text-3xl font-bold">Settings</h2>
        <p className="mt-2 text-sm text-blue-100">Manage account context and session security controls.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Account</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <User size={16} className="text-slate-500" />
              <span className="text-slate-600">Username:</span>
              <span className="font-medium text-slate-900">{user.username || "Not set"}</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail size={16} className="text-slate-500" />
              <span className="text-slate-600">Email:</span>
              <span className="font-medium text-slate-900">{user.email || "Not set"}</span>
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Session Security</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Lock size={16} className="text-slate-500" />
              <span className="text-slate-600">Session expires:</span>
              <span className="font-medium text-slate-900">{formatDateTime(sessionExpiry)}</span>
            </div>
            <button
              className="mt-2 inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
              onClick={async () => {
                try {
                  await apiFetch("/auth/logout", { method: "POST" });
                } catch {
                  // Continue with local cleanup.
                }
                clearMasterKey();
                clearSession();
                navigate("/login");
              }}
            >
              <LogOut size={15} />
              Logout from this device
            </button>
          </div>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Recommended next settings</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="mb-2 inline-flex items-center gap-2 font-medium text-slate-900">
              <ShieldCheck size={15} />
              Password change
            </div>
            <p className="text-slate-600">Add backend endpoint + UI for password rotation with old-password verification.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="mb-2 inline-flex items-center gap-2 font-medium text-slate-900">
              <Bell size={15} />
              Alert preferences
            </div>
            <p className="text-slate-600">Notify on new share access, view-limit reached, and link expiry reminders.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="mb-2 inline-flex items-center gap-2 font-medium text-slate-900">
              <Lock size={15} />
              Trusted devices
            </div>
            <p className="text-slate-600">Track active devices and allow one-click revoke for suspicious sessions.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Settings;
